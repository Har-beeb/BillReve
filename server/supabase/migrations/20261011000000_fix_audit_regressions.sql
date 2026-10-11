-- =============================================================================
-- 20261011000000_fix_audit_regressions.sql
--
-- Repairs the defects found in the 2026-10-10 verification audit. Everything
-- here is a correction to something that landed between 2026-10-08 and
-- 2026-10-09, mostly collateral damage from the multi-tenant rewrite
-- (20261009020000) which dropped `profiles` and the `user_id` columns while
-- several functions kept referencing them.
--
-- Safe to run more than once: every statement is idempotent.
--
-- Sections
--   1. is_member_of        - pin search_path, lock down EXECUTE
--   2. organization_members - add the missing write policies (RBAC)
--   3. Policy coverage      - notifications INSERT, user_secrets DELETE
--   4. Public status RPC    - restore idempotent amount_paid, tighten allow-list
--   5. check_rate_limit     - un-spoofable IP key + per-document ceiling
--   6. check_and_log_rate_limit - re-point at organization_id (was BROKEN)
--   7. empty_trash_based_on_plan - re-point at organizations (was BROKEN)
--   8. check_user_quota     - monthly windows: 5 clients, 10 invoices, 10 quotes
--   9. get_public_profile   - explicit column list, stop leaking contact details
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. is_member_of: the most privileged function in the schema was the only
--    SECURITY DEFINER without a pinned search_path.
--
--    Ownership is set explicitly because the absence of RLS recursion depends
--    on it: the function body reads organization_members, and that table's
--    SELECT policy calls this function. Postgres skips RLS for a table's owner,
--    which is the only reason this terminates. Leaving ownership implicit made
--    a working system depend on an undocumented accident.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_member_of(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = _org_id AND user_id = auth.uid()
    );
$$;

ALTER FUNCTION public.is_member_of(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_member_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid) TO authenticated;

-- Companion helper: is the caller an OWNER of the org (not merely a member)?
-- The `role` column has existed since the rewrite but was referenced by no
-- policy and no function, so every member was effectively an owner.
CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = _org_id
          AND user_id = auth.uid()
          AND role = 'owner'
    );
$$;

ALTER FUNCTION public.is_org_owner(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. organization_members had ONLY a SELECT policy, so no member could ever be
--    added through the API and multi-tenancy was unreachable. These policies
--    make invites possible while keeping the escalation door shut: only an
--    existing owner of that org may add, modify or remove members.
--
--    Tighten the nullable tenancy keys at the same time - UNIQUE(org, user)
--    does not constrain NULLs, so duplicate (NULL, NULL) rows were permitted.
-- -----------------------------------------------------------------------------
DELETE FROM public.organization_members
 WHERE organization_id IS NULL OR user_id IS NULL;

ALTER TABLE public.organization_members
    ALTER COLUMN organization_id SET NOT NULL,
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.organization_members
    DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'admin', 'member'));

DROP POLICY IF EXISTS "Owners can add members" ON public.organization_members;
CREATE POLICY "Owners can add members" ON public.organization_members
    FOR INSERT WITH CHECK (public.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Owners can update members" ON public.organization_members;
CREATE POLICY "Owners can update members" ON public.organization_members
    FOR UPDATE USING (public.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Owners can remove members" ON public.organization_members;
CREATE POLICY "Owners can remove members" ON public.organization_members
    FOR DELETE USING (public.is_org_owner(organization_id));


-- -----------------------------------------------------------------------------
-- 3. Policy coverage gaps. Both are currently written only by SECURITY DEFINER
--    triggers, so nothing is broken today - but a table with RLS on and no
--    policy silently denies, which is a confusing failure to debug later.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can insert notifications" ON public.notifications;
CREATE POLICY "Members can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "Owners can delete secrets" ON public.user_secrets;
CREATE POLICY "Owners can delete secrets" ON public.user_secrets
    FOR DELETE USING (public.is_org_owner(organization_id));


-- -----------------------------------------------------------------------------
-- 4. update_invoice_status_public
--
--    REGRESSION BEING FIXED: 20261008080000 correctly made amount_paid
--    idempotent (`= COALESCE(p_amount_paid, amount_paid)`). The next day,
--    20261009090000 dropped every overload to clear a PGRST203 ambiguity and
--    recreated the body from the PRE-FIX version, restoring the additive
--    `amount_paid + p_amount_paid`. It also added 'PARTIAL' to the public
--    allow-list. Combined with the client sending p_amount_paid on every
--    checkout, repeat attempts inflated amount_paid without bound.
--
--    The client no longer sends an amount at all - the gateway webhook is the
--    only writer of amount_paid and the only thing that may set PAID. The
--    parameter is retained for signature compatibility but is now idempotent.
--
--    Drop ALL overloads first so a stale signature cannot resurface as
--    PGRST203 again.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    func_record record;
BEGIN
    FOR func_record IN
        SELECT oid::regprocedure AS sig
        FROM pg_proc
        WHERE proname = 'update_invoice_status_public'
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.sig || ' CASCADE;';
    END LOOP;
END $$;

CREATE FUNCTION public.update_invoice_status_public(
    p_local_id text,
    p_status text,
    p_amount_paid bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_invoice record;
BEGIN
    -- A public, unauthenticated caller may only move an invoice into a state
    -- that asserts intent, never one that asserts settlement. PAID and PARTIAL
    -- are both excluded: they are the webhook's to set, after it has verified
    -- the amount against the invoice total.
    IF p_status NOT IN ('PENDING', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT') THEN
        RAISE EXCEPTION 'Invalid public invoice status transition: %', p_status;
    END IF;

    IF NOT public.check_rate_limit(p_local_id, 'invoice_status', 5, 10) THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
    END IF;

    SELECT * INTO v_target_invoice
    FROM public.invoices
    WHERE local_id = p_local_id;

    IF v_target_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    -- Never move a settled invoice backwards from a public link.
    IF v_target_invoice.status = 'PAID' THEN
        RAISE EXCEPTION 'This invoice is already settled';
    END IF;

    UPDATE public.invoices
    SET
        status      = COALESCE(p_status, status),
        -- IDEMPOTENT: set, never increment. Replaying this call is a no-op.
        amount_paid = COALESCE(p_amount_paid, amount_paid),
        updated_at  = now()
    WHERE local_id = p_local_id;
END;
$$;

ALTER FUNCTION public.update_invoice_status_public(text, text, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_invoice_status_public(text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_invoice_status_public(text, text, bigint) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. check_rate_limit
--
--    Two problems. First, the key was built from the whole X-Forwarded-For
--    header, which a caller can set themselves and rotate freely - trivially
--    bypassable. Take only the leftmost token (the originating client) and trim.
--
--    Second, keying on (ip, document) alone means a determined attacker who
--    rotates XFF has an unbounded budget. Keying on the document alone - the
--    pre-2026-10-08 behaviour - let an attacker burn a legitimate client's five
--    attempts and block them from accepting a quote. Neither is sufficient
--    alone, so both now apply: a tight per-(ip, document) limit, plus a
--    generous per-document ceiling that bounds total abuse without being
--    reachable by a real client.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clean_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE attempted_at < now() - interval '1 hour';
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_minutes INT DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts        INT;
  v_doc_attempts    INT;
  v_client_ip       TEXT;
  v_key             TEXT;
  -- Per-document ceiling. A real client clicks a handful of times; this only
  -- trips under automated abuse across many rotated source addresses.
  c_doc_ceiling     CONSTANT INT := 60;
  c_doc_window_mins CONSTANT INT := 60;
BEGIN
  -- Leftmost XFF entry is the originating client. Anything further right is a
  -- proxy hop. btrim because the header is comma-space separated.
  v_client_ip := NULLIF(btrim(split_part(
      COALESCE(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1)), '');
  v_client_ip := COALESCE(v_client_ip, inet_client_addr()::text, 'unknown');

  v_key := v_client_ip || ':' || p_identifier;

  IF random() < 0.01 THEN
    PERFORM public.clean_old_rate_limits();
  END IF;

  -- (a) tight per-source-per-document limit
  SELECT COUNT(*) INTO v_attempts
  FROM public.rate_limits
  WHERE identifier = v_key
    AND action = p_action
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  IF v_attempts >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  -- (b) generous per-document ceiling, independent of source address
  SELECT COUNT(*) INTO v_doc_attempts
  FROM public.rate_limits
  WHERE identifier LIKE '%:' || p_identifier
    AND action = p_action
    AND attempted_at > now() - (c_doc_window_mins || ' minutes')::interval;

  IF v_doc_attempts >= c_doc_ceiling THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limits (identifier, action) VALUES (v_key, p_action);
  RETURN TRUE;
END;
$$;

-- Drop the untenanted 3-argument overload added by 20261009030000. It counted
-- api_logs with no organization or user predicate at all - one global bucket
-- shared by every tenant, so a single org could exhaust the limit for everyone.
-- It also returned TRUE without recording the attempt when the caller had no
-- membership row. No live caller uses it.
DROP FUNCTION IF EXISTS public.check_rate_limit(text, integer, integer);


-- -----------------------------------------------------------------------------
-- 6. check_and_log_rate_limit - WAS COMPLETELY BROKEN
--
--    Still filtered and inserted on api_logs.user_id, a column dropped by
--    20261009020000. api_logs.organization_id is also NOT NULL, so both the
--    SELECT and the INSERT raised. Live callers are the `ai` and `send-email`
--    edge functions, which means AI and transactional email were failing.
--
--    Signature is preserved exactly so no edge function needs redeploying for
--    the call to type-check; the user -> organization lookup happens inside.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_log_rate_limit(
    p_user_id uuid,
    p_endpoint text,
    p_limit integer,
    p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count  INT;
    v_org_id uuid;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = p_user_id
    LIMIT 1;

    -- Fail CLOSED. Previously the no-membership path fell through and granted
    -- the request without recording it.
    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.api_logs
    WHERE organization_id = v_org_id
      AND endpoint = p_endpoint
      AND created_at >= now() - (p_window_minutes || ' minutes')::INTERVAL;

    IF v_count < p_limit THEN
        INSERT INTO public.api_logs (organization_id, endpoint)
        VALUES (v_org_id, p_endpoint);
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

ALTER FUNCTION public.check_and_log_rate_limit(uuid, text, integer, integer) OWNER TO postgres;

-- Supports both the rate-limit window query above and the monthly AI quota
-- count in the `ai` edge function.
CREATE INDEX IF NOT EXISTS idx_api_logs_org_endpoint_created
    ON public.api_logs (organization_id, endpoint, created_at DESC);


-- -----------------------------------------------------------------------------
-- 7. empty_trash_based_on_plan - WAS COMPLETELY BROKEN
--
--    Joined public.profiles on i.user_id. Both were dropped by 20261009020000,
--    and because the body is PL/pgSQL, DROP TABLE ... CASCADE neither dropped
--    nor rewrote it. It is scheduled daily via pg_cron, so every run has been
--    erroring and soft-deleted rows were never purged - the 7/30-day retention
--    policy had silently stopped working.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.empty_trash_based_on_plan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Pro organizations keep deleted items for 30 days, free ones for 7.
    DELETE FROM public.invoices i
    USING public.organizations o
    WHERE i.organization_id = o.id
      AND i.deleted_at IS NOT NULL
      AND i.deleted_at < now() - (CASE WHEN COALESCE(o.is_pro, false) THEN interval '30 days'
                                                                      ELSE interval '7 days' END);

    DELETE FROM public.quotes q
    USING public.organizations o
    WHERE q.organization_id = o.id
      AND q.deleted_at IS NOT NULL
      AND q.deleted_at < now() - (CASE WHEN COALESCE(o.is_pro, false) THEN interval '30 days'
                                                                      ELSE interval '7 days' END);

    DELETE FROM public.clients c
    USING public.organizations o
    WHERE c.organization_id = o.id
      AND c.deleted_at IS NOT NULL
      AND c.deleted_at < now() - (CASE WHEN COALESCE(o.is_pro, false) THEN interval '30 days'
                                                                      ELSE interval '7 days' END);
END;
$$;

ALTER FUNCTION public.empty_trash_based_on_plan() OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- 8. check_user_quota - free tier is MONTHLY, and includes clients
--
--    Three defects in the 20261009070000 version:
--      a) it counted LIFETIME documents, not a monthly window
--      b) the limit had been silently changed from 10 to 5 inside a migration
--         titled "fix remaining legacy triggers"
--      c) the branch counting clients was dead code - the trigger was only ever
--         attached to invoices and quotes, so the client cap was never enforced
--         server-side at all
--      d) if the org lookup missed, v_is_pro was NULL, `NOT NULL` evaluated to
--         NULL, the IF fell through and the quota was not enforced
--
--    Confirmed free tier: 5 clients, 10 invoices per month, 10 quotes per month.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_pro       boolean;
    v_pro_expires  timestamptz;
    v_count        INT;
    v_limit        INT;
    v_month_start  timestamptz := date_trunc('month', now());
BEGIN
    IF NEW.organization_id IS NULL THEN
        RAISE EXCEPTION 'Cannot create records without an organization';
    END IF;

    SELECT is_pro, pro_expires_at
      INTO v_is_pro, v_pro_expires
      FROM public.organizations
     WHERE id = NEW.organization_id;

    -- Fail CLOSED on a missing organization rather than falling through.
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    -- An expired Pro subscription is not Pro.
    IF COALESCE(v_is_pro, false)
       AND (v_pro_expires IS NULL OR v_pro_expires > now()) THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'clients' THEN
        -- Clients are a standing total, not a monthly flow.
        SELECT COUNT(*) INTO v_count
          FROM public.clients
         WHERE organization_id = NEW.organization_id
           AND deleted_at IS NULL;
        v_limit := 5;

        IF v_count >= v_limit THEN
            RAISE EXCEPTION 'Free tier limit reached (% clients). Upgrade to Pro for unlimited clients.', v_limit;
        END IF;

    ELSIF TG_TABLE_NAME = 'invoices' THEN
        SELECT COUNT(*) INTO v_count
          FROM public.invoices
         WHERE organization_id = NEW.organization_id
           AND deleted_at IS NULL
           AND created_at >= v_month_start;
        v_limit := 10;

        IF v_count >= v_limit THEN
            RAISE EXCEPTION 'Free tier limit reached (% invoices this month). Upgrade to Pro for unlimited invoices.', v_limit;
        END IF;

    ELSIF TG_TABLE_NAME = 'quotes' THEN
        SELECT COUNT(*) INTO v_count
          FROM public.quotes
         WHERE organization_id = NEW.organization_id
           AND deleted_at IS NULL
           AND created_at >= v_month_start;
        v_limit := 10;

        IF v_count >= v_limit THEN
            RAISE EXCEPTION 'Free tier limit reached (% quotes this month). Upgrade to Pro for unlimited quotes.', v_limit;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.check_user_quota() OWNER TO postgres;

-- Attach to clients as well, so the 5-client cap is actually enforced.
DROP TRIGGER IF EXISTS enforce_client_quota ON public.clients;
CREATE TRIGGER enforce_client_quota
    BEFORE INSERT ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.check_user_quota();

CREATE INDEX IF NOT EXISTS idx_invoices_org_created
    ON public.invoices (organization_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_org_created
    ON public.quotes (organization_id, created_at DESC) WHERE deleted_at IS NULL;


-- -----------------------------------------------------------------------------
-- 9. get_public_profile - stop returning the whole organizations row to anon
--
--    It was `RETURNS SETOF organizations` doing `SELECT *`, callable by anon
--    for any org UUID, over a table holding email, phone, address, email_flags,
--    is_pro and pro_expires_at. Only the fields the public invoice and quote
--    pages actually render are returned now.
--
--    Verified against the public pages: they use name, address, currency,
--    logo_url, is_pro, bank_accounts, paystack_public_key and
--    flutterwave_public_key. bank_accounts is required - it is how a client
--    pays by transfer. email, phone, pro_expires_at, email_flags, industry and
--    business_description are not used and are no longer exposed.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_public_profile(uuid) CASCADE;

CREATE FUNCTION public.get_public_profile(p_id uuid)
RETURNS TABLE (
    id                     uuid,
    name                   text,
    address                text,
    logo_url               text,
    country                text,
    currency               text,
    bank_accounts          jsonb,
    paystack_public_key    text,
    flutterwave_public_key text,
    is_pro                 boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT o.id,
           o.name,
           o.address,
           o.logo_url,
           o.country,
           o.currency,
           o.bank_accounts,
           o.paystack_public_key,
           o.flutterwave_public_key,
           COALESCE(o.is_pro, false)
      FROM public.organizations o
     WHERE o.id = p_id
     LIMIT 1;
$$;

ALTER FUNCTION public.get_public_profile(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;


-- Make PostgREST pick up the new signatures immediately.
NOTIFY pgrst, 'reload schema';
