-- =============================================================================
-- 20261014010000_campaign_credit_packs.sql
--
-- Adds the paid top-up: ₦2,000 buys 1,000 extra campaign emails, on top of the
-- 250/month included with Pro.
--
-- MODEL
--   Base allowance  — 250 per calendar month, resets, does NOT accumulate.
--   Credits         — purchased packs, a running balance that persists until
--                     spent. Only consumed once the monthly base is exhausted.
--
-- Credits are debited at QUEUE time rather than per-send. The user has already
-- committed to the send at that point, the arithmetic is done once inside a
-- transaction, and a partially-failed send does not silently refund — which
-- matches how the recipient rows are already reserved.
--
-- PRICING NOTE (for whoever changes these numbers later)
--   Resend costs roughly $0.0004/email, so 1,000 emails is about $0.40. The
--   pack is priced at ₦2,000 to leave real margin while staying small enough
--   that volume grows gradually — which matters, because a young sending
--   domain that suddenly emits thousands of emails gets throttled.
-- =============================================================================

-- Running balance of purchased emails. Kept on the organization so the quota
-- check is a single row read.
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS campaign_credits_balance integer NOT NULL DEFAULT 0;

ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_campaign_credits_non_negative;
ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_campaign_credits_non_negative
    CHECK (campaign_credits_balance >= 0);

-- -----------------------------------------------------------------------------
-- campaign_credit_purchases
--
-- Audit trail and idempotency guard. The UNIQUE gateway reference is what makes
-- a replayed payment webhook a no-op instead of free credits.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_credit_purchases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    emails          integer NOT NULL CHECK (emails > 0),
    amount_minor    bigint,
    currency        text,
    gateway         text NOT NULL,
    reference       text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT campaign_credit_purchases_reference_key UNIQUE (gateway, reference)
);

CREATE INDEX IF NOT EXISTS idx_campaign_credit_purchases_org
    ON public.campaign_credit_purchases (organization_id, created_at DESC);

ALTER TABLE public.campaign_credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view credit purchases" ON public.campaign_credit_purchases;
-- Read-only to clients. Writes happen only through grant_campaign_credits,
-- called by the payment webhook with the service role — otherwise a user could
-- grant themselves credits.
CREATE POLICY "Members view credit purchases" ON public.campaign_credit_purchases
    FOR SELECT USING (public.is_member_of(organization_id));


-- -----------------------------------------------------------------------------
-- grant_campaign_credits
--
-- Called by the payment webhook once a pack is paid for. Idempotent: a replayed
-- webhook collides on (gateway, reference) and adds nothing.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_campaign_credits(
    p_org_id       uuid,
    p_emails       integer,
    p_gateway      text,
    p_reference    text,
    p_amount_minor bigint DEFAULT NULL,
    p_currency     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inserted boolean;
    v_balance  integer;
BEGIN
    IF p_emails IS NULL OR p_emails <= 0 THEN
        RAISE EXCEPTION 'Credit grant must be positive, got %', p_emails;
    END IF;
    IF p_reference IS NULL OR btrim(p_reference) = '' THEN
        RAISE EXCEPTION 'A gateway reference is required for idempotency';
    END IF;

    INSERT INTO public.campaign_credit_purchases
        (organization_id, emails, amount_minor, currency, gateway, reference)
    VALUES
        (p_org_id, p_emails, p_amount_minor, p_currency, p_gateway, btrim(p_reference))
    ON CONFLICT (gateway, reference) DO NOTHING;

    v_inserted := FOUND;

    IF NOT v_inserted THEN
        SELECT campaign_credits_balance INTO v_balance
          FROM public.organizations WHERE id = p_org_id;
        RETURN jsonb_build_object('granted', false, 'reason', 'DUPLICATE',
                                  'balance', COALESCE(v_balance, 0));
    END IF;

    UPDATE public.organizations
       SET campaign_credits_balance = campaign_credits_balance + p_emails,
           updated_at = now()
     WHERE id = p_org_id
    RETURNING campaign_credits_balance INTO v_balance;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Organization % not found', p_org_id;
    END IF;

    RETURN jsonb_build_object('granted', true, 'emails', p_emails, 'balance', v_balance);
END;
$$;

ALTER FUNCTION public.grant_campaign_credits(uuid, integer, text, text, bigint, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.grant_campaign_credits(uuid, integer, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_campaign_credits(uuid, integer, text, text, bigint, text) TO service_role;


-- -----------------------------------------------------------------------------
-- check_campaign_quota — now credit-aware
--
-- Supersedes the version in 20261014000000. Allowance is the remaining monthly
-- base plus the purchased credit balance.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_campaign_quota(
    p_recipient_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id           uuid;
    v_is_pro           boolean;
    v_pro_expires      timestamptz;
    v_credits          integer;
    v_month_start      timestamptz := date_trunc('month', now());
    v_sent_this_month  integer;
    v_recent_campaigns integer;
    v_base_remaining   integer;
    v_total_available  integer;
    c_monthly_cap      CONSTANT integer := 250;
    c_weekly_campaigns CONSTANT integer := 2;
BEGIN
    SELECT organization_id INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'NO_ORGANIZATION',
            'message', 'We could not resolve your workspace. Please sign out and back in.');
    END IF;

    SELECT is_pro, pro_expires_at, COALESCE(campaign_credits_balance, 0)
      INTO v_is_pro, v_pro_expires, v_credits
      FROM public.organizations WHERE id = v_org_id;

    IF NOT (COALESCE(v_is_pro, false) AND (v_pro_expires IS NULL OR v_pro_expires > now())) THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'PRO_REQUIRED',
            'monthlyCap', c_monthly_cap,
            'message', 'Email campaigns are a Pro feature. Upgrade to send campaigns to your clients.');
    END IF;

    SELECT COUNT(*) INTO v_sent_this_month
      FROM public.campaign_recipients
     WHERE organization_id = v_org_id
       AND status = 'SENT'
       AND sent_at >= v_month_start;

    SELECT COUNT(*) INTO v_recent_campaigns
      FROM public.campaigns
     WHERE organization_id = v_org_id
       AND status IN ('QUEUED','SENDING','SENT','PARTIAL')
       AND created_at >= now() - interval '7 days';

    v_base_remaining  := GREATEST(c_monthly_cap - v_sent_this_month, 0);
    v_total_available := v_base_remaining + v_credits;

    -- Frequency limit applies regardless of how many credits are held. Buying a
    -- pack does not buy the right to mail the same list every other day; that
    -- pattern is what gets a sending domain throttled.
    IF v_recent_campaigns >= c_weekly_campaigns THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'FREQUENCY_LIMIT',
            'monthlyCap', c_monthly_cap,
            'sentThisMonth', v_sent_this_month,
            'baseRemaining', v_base_remaining,
            'credits', v_credits,
            'remaining', v_total_available,
            'campaignsThisWeek', v_recent_campaigns,
            'weeklyCampaignCap', c_weekly_campaigns,
            'message', format('You have already sent %s campaigns in the last 7 days. Sending more often than this harms your delivery rate, so the limit is %s per week.',
                              v_recent_campaigns, c_weekly_campaigns));
    END IF;

    IF GREATEST(p_recipient_count, 0) > v_total_available THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'MONTHLY_CAP',
            'monthlyCap', c_monthly_cap,
            'sentThisMonth', v_sent_this_month,
            'baseRemaining', v_base_remaining,
            'credits', v_credits,
            'remaining', v_total_available,
            'shortfall', GREATEST(p_recipient_count, 0) - v_total_available,
            'message', format('This campaign needs %s emails but you have %s available (%s left of your monthly %s, plus %s purchased credits).',
                              p_recipient_count, v_total_available, v_base_remaining, c_monthly_cap, v_credits));
    END IF;

    RETURN jsonb_build_object('allowed', true,
        'monthlyCap', c_monthly_cap,
        'sentThisMonth', v_sent_this_month,
        'baseRemaining', v_base_remaining,
        'credits', v_credits,
        'remaining', v_total_available,
        'campaignsThisWeek', v_recent_campaigns,
        'weeklyCampaignCap', c_weekly_campaigns);
END;
$$;

ALTER FUNCTION public.check_campaign_quota(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_campaign_quota(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_campaign_quota(integer) TO authenticated;


-- -----------------------------------------------------------------------------
-- queue_campaign — now debits credits for the overflow
--
-- Supersedes the version in 20261014000000. Identical behaviour, except that
-- any recipients beyond the remaining monthly base are paid for out of the
-- purchased credit balance, debited inside the same transaction that creates
-- the recipient rows.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_campaign(
    p_subject         text,
    p_title           text,
    p_preview_text    text,
    p_content_html    text,
    p_content_json    jsonb,
    p_client_ids      text[],
    p_proofread       jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id       uuid;
    v_quota        jsonb;
    v_campaign_id  uuid;
    v_eligible     integer;
    v_suppressed   integer;
    v_no_email     integer;
    v_blocking     integer := 0;
    v_base_left    integer;
    v_credits_used integer := 0;
BEGIN
    SELECT organization_id INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_ORGANIZATION',
            'message', 'We could not resolve your workspace.');
    END IF;

    IF p_subject IS NULL OR btrim(p_subject) = '' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_SUBJECT',
            'message', 'A campaign needs a subject line.');
    END IF;

    IF p_content_html IS NULL OR btrim(p_content_html) = '' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_CONTENT',
            'message', 'A campaign needs some content.');
    END IF;

    IF p_proofread IS NOT NULL THEN
        SELECT COALESCE(jsonb_array_length(p_proofread -> 'blocking'), 0) INTO v_blocking;
        IF v_blocking > 0 THEN
            RETURN jsonb_build_object('success', false, 'reason', 'PROOFREAD_BLOCKED',
                'message', 'This campaign has issues that would likely get it blocked or marked as spam. Resolve them and try again.',
                'report', p_proofread);
        END IF;
    END IF;

    WITH chosen AS (
        SELECT c.local_id, lower(btrim(c.email)) AS email
          FROM public.clients c
         WHERE c.organization_id = v_org_id
           AND c.deleted_at IS NULL
           AND c.local_id = ANY (p_client_ids)
    )
    SELECT
        COUNT(*) FILTER (
            WHERE email IS NOT NULL AND email <> ''
              AND NOT EXISTS (
                  SELECT 1 FROM public.email_suppressions s
                   WHERE s.organization_id = v_org_id AND s.email = chosen.email)
        ),
        COUNT(*) FILTER (
            WHERE email IS NOT NULL AND email <> ''
              AND EXISTS (
                  SELECT 1 FROM public.email_suppressions s
                   WHERE s.organization_id = v_org_id AND s.email = chosen.email)
        ),
        COUNT(*) FILTER (WHERE email IS NULL OR email = '')
      INTO v_eligible, v_suppressed, v_no_email
      FROM chosen;

    IF COALESCE(v_eligible, 0) = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_RECIPIENTS',
            'suppressed', COALESCE(v_suppressed, 0),
            'missingEmail', COALESCE(v_no_email, 0),
            'message', 'None of the selected clients can be emailed — they either have no email address or have unsubscribed.');
    END IF;

    v_quota := public.check_campaign_quota(v_eligible);
    IF NOT (v_quota ->> 'allowed')::boolean THEN
        RETURN jsonb_build_object('success', false,
            'reason', v_quota ->> 'reason',
            'message', v_quota ->> 'message',
            'quota', v_quota);
    END IF;

    -- Spend the monthly base first, then purchased credits.
    v_base_left := COALESCE((v_quota ->> 'baseRemaining')::integer, 0);
    IF v_eligible > v_base_left THEN
        v_credits_used := v_eligible - v_base_left;

        UPDATE public.organizations
           SET campaign_credits_balance = campaign_credits_balance - v_credits_used,
               updated_at = now()
         WHERE id = v_org_id
           AND campaign_credits_balance >= v_credits_used;

        IF NOT FOUND THEN
            -- Lost a race against a concurrent campaign. The CHECK constraint
            -- would have caught it anyway; this gives a readable error.
            RETURN jsonb_build_object('success', false, 'reason', 'INSUFFICIENT_CREDITS',
                'message', 'Your campaign credits were used by another send. Please refresh and try again.');
        END IF;
    END IF;

    INSERT INTO public.campaigns (
        organization_id, subject, title, preview_text, content_html, content_json,
        status, recipient_count, proofread_report, queued_at
    )
    VALUES (
        v_org_id, btrim(p_subject), p_title, p_preview_text, p_content_html, p_content_json,
        'QUEUED', v_eligible, p_proofread, now()
    )
    RETURNING id INTO v_campaign_id;

    INSERT INTO public.campaign_recipients (campaign_id, organization_id, client_id, email)
    SELECT v_campaign_id, v_org_id, c.local_id, lower(btrim(c.email))
      FROM public.clients c
     WHERE c.organization_id = v_org_id
       AND c.deleted_at IS NULL
       AND c.local_id = ANY (p_client_ids)
       AND c.email IS NOT NULL
       AND btrim(c.email) <> ''
       AND NOT EXISTS (
           SELECT 1 FROM public.email_suppressions s
            WHERE s.organization_id = v_org_id
              AND s.email = lower(btrim(c.email)))
    ON CONFLICT (campaign_id, email) DO NOTHING;

    RETURN jsonb_build_object('success', true,
        'campaignId', v_campaign_id,
        'queued', v_eligible,
        'suppressed', COALESCE(v_suppressed, 0),
        'missingEmail', COALESCE(v_no_email, 0),
        'creditsUsed', v_credits_used,
        'quota', public.check_campaign_quota(0),
        'message', format('Campaign queued for %s recipients.', v_eligible));
END;
$$;

ALTER FUNCTION public.queue_campaign(text, text, text, text, jsonb, text[], jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.queue_campaign(text, text, text, text, jsonb, text[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_campaign(text, text, text, text, jsonb, text[], jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
