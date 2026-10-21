-- =============================================================================
-- 20261018000000_public_profile_pro_expiry.sql
--
-- Makes `get_public_profile` report Pro status as a RESOLVED value rather than
-- the raw stored flag.
--
-- THE BUG
-- `organizations.is_pro` and `organizations.pro_expires_at` are two pieces of
-- one fact. The expiry sweep in `email-cron` clears both, but it only ran while
-- it was scheduled (see 20261015010000 — it never had been), and even once it
-- runs daily there is a window where `is_pro` is still true and the date has
-- passed.
--
-- Every internal check already treats expires_at as authoritative:
--   client `useAppStore` isProUser   is_pro && (!pro_expires_at || > now())
--   `ai` edge function               is_pro && (no expiry || > now)
--   `check_campaign_quota`           is_pro && (no expiry || > now)
--
-- But `get_public_profile` returned `is_pro` verbatim to `anon`. That value
-- drives the customer-facing invoice page: whether the "Pay Now" gateway
-- buttons appear, and whose name appears in the footer. So a lapsed Pro
-- merchant kept a working online checkout on public invoices — BillReve paying
-- gateway fees on behalf of a non-paying customer — while the app itself showed
-- them as downgraded.
--
-- Fixing it in the RPC rather than in the React component means the server is
-- the source of truth. The client cannot be tricked into showing a payment
-- option it is not entitled to, because it is never told the raw flag.
--
-- The column keeps the name `is_pro` so the existing client code needs no
-- change; only its meaning sharpens from "ever subscribed" to "is subscribed".
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_profile(p_id uuid)
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
           -- Resolved, not raw. An expired subscription is not Pro, regardless
           -- of what the boolean still says.
           (
               COALESCE(o.is_pro, false)
               AND (o.pro_expires_at IS NULL OR o.pro_expires_at > now())
           ) AS is_pro
      FROM public.organizations o
     WHERE o.id = p_id
     LIMIT 1;
$$;

ALTER FUNCTION public.get_public_profile(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Also make the sweep's intent explicit: it is a tidier-upper, not the
-- mechanism that enforces expiry. Every read path now resolves expiry itself,
-- so a missed sweep can no longer grant access — it only leaves the stored row
-- looking untidy. Rewritten here so the two facts stay in step, and so it is
-- obvious to the next reader that correctness does not depend on the cron.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired_pro_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated integer;
BEGIN
    UPDATE public.organizations
       SET is_pro = false,
           pro_expires_at = NULL,
           updated_at = now()
     WHERE is_pro = true
       AND pro_expires_at IS NOT NULL
       AND pro_expires_at <= now();

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

ALTER FUNCTION public.sweep_expired_pro_subscriptions() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sweep_expired_pro_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_expired_pro_subscriptions() TO service_role;

NOTIFY pgrst, 'reload schema';
