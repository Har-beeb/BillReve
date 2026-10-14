-- =============================================================================
-- 20261014000000_campaign_system.sql
--
-- Foundation for the campaign system: persistence, consent, suppression and
-- quota. None of this existed before — campaigns were fire-and-forget. There
-- was no `campaigns` table at all, so no history, no analytics, and no way to
-- know who actually received anything.
--
-- WHY THIS MATTERS BEYOND FEATURES
-- Since February 2024 Gmail and Yahoo require bulk senders to provide
-- one-click unsubscribe (RFC 8058) and to keep spam complaints under 0.3%.
-- Campaigns previously shipped with NO unsubscribe link of any kind, and
-- bounces and complaints were never recorded — so repeated sends went to dead
-- addresses and reputation decayed with every campaign. Because campaigns and
-- invoices send from the same domain today, that damage lands on INVOICE
-- deliverability, which is the part of the product people actually depend on.
--
-- Tables
--   campaigns             one row per campaign, with denormalised counters
--   campaign_recipients   one row per recipient, carrying the unsubscribe token
--   email_suppressions    do-not-send list, per organization
--
-- Functions
--   check_campaign_quota     Pro gate + 250/month + 2 campaigns/week
--   unsubscribe_by_token     anon-callable, idempotent
--   record_email_suppression service-role, used by the Resend webhook
-- =============================================================================

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    subject          text NOT NULL,
    title            text,
    preview_text     text,
    -- Email-safe HTML, already sanitised and inlined by the client.
    content_html     text NOT NULL,
    -- Editor state, so a draft can be reopened and edited faithfully.
    content_json     jsonb,

    status           text NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT','QUEUED','SENDING','SENT','PARTIAL','FAILED','BLOCKED')),

    -- Denormalised counters, maintained by the worker. Cheap dashboard reads.
    recipient_count  integer NOT NULL DEFAULT 0,
    sent_count       integer NOT NULL DEFAULT 0,
    failed_count     integer NOT NULL DEFAULT 0,
    bounced_count    integer NOT NULL DEFAULT 0,
    complained_count integer NOT NULL DEFAULT 0,
    unsubscribed_count integer NOT NULL DEFAULT 0,

    -- Output of the proofread gate, kept for audit and for showing the user
    -- why a campaign was refused.
    proofread_report jsonb,

    created_at       timestamptz NOT NULL DEFAULT now(),
    queued_at        timestamptz,
    sent_at          timestamptz,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_created
    ON public.campaigns (organization_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- campaign_recipients
--
-- One row per recipient so a send is resumable and auditable. Resend's batch
-- endpoint caps at 100 per call; the previous implementation passed EVERY
-- address in a single invoke, so a campaign to 300 clients failed or silently
-- truncated and there was no record of who received it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id           text,
    email               text NOT NULL,

    status              text NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','SENT','FAILED','BOUNCED','COMPLAINED','SUPPRESSED')),

    -- Per-recipient secret backing the one-click unsubscribe link. Must be
    -- unguessable: it is the only credential on a public endpoint.
    --
    -- Built from two gen_random_uuid() calls rather than
    -- encode(gen_random_bytes(24),'hex'). gen_random_bytes is a pgcrypto
    -- function, and on Supabase pgcrypto is installed into the `extensions`
    -- schema, so it does not resolve unqualified from a migration. Hardcoding
    -- `extensions.gen_random_bytes` would bake in a schema assumption that
    -- could break on a differently-configured project. gen_random_uuid() is
    -- core Postgres (13+) and CSPRNG-backed, so two of them concatenated give
    -- 64 hex characters with ample entropy and zero extension dependency.
    unsubscribe_token   text NOT NULL
                        DEFAULT replace(gen_random_uuid()::text, '-', '')
                             || replace(gen_random_uuid()::text, '-', ''),

    provider_message_id text,
    error               text,
    attempts            integer NOT NULL DEFAULT 0,
    sent_at             timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT campaign_recipients_token_key UNIQUE (unsubscribe_token),
    CONSTRAINT campaign_recipients_unique_email UNIQUE (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_pending
    ON public.campaign_recipients (campaign_id, status) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_org_sent
    ON public.campaign_recipients (organization_id, sent_at DESC) WHERE status = 'SENT';

-- -----------------------------------------------------------------------------
-- email_suppressions
--
-- The do-not-send list. Checked before every campaign send. Fed by unsubscribes
-- and by the Resend bounce/complaint webhook.
--
-- Scoped per organization: one merchant's unsubscribe must not silently remove
-- a contact from another merchant's list, and a hard bounce is address-level so
-- it is recorded for the org that hit it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_suppressions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email           text NOT NULL,
    reason          text NOT NULL
                    CHECK (reason IN ('UNSUBSCRIBED','BOUNCED','COMPLAINED','MANUAL')),
    detail          text,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT email_suppressions_unique UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_lookup
    ON public.email_suppressions (organization_id, email);


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view campaigns"   ON public.campaigns;
DROP POLICY IF EXISTS "Members insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Members update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Members delete campaigns" ON public.campaigns;

CREATE POLICY "Members view campaigns" ON public.campaigns
    FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY "Members insert campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (public.is_member_of(organization_id));
-- Only DRAFT campaigns are editable from the client. Once queued, the worker
-- owns the row — otherwise a user could rewrite the body mid-send, so some
-- recipients receive content that never passed the proofread gate.
CREATE POLICY "Members update campaigns" ON public.campaigns
    FOR UPDATE USING (public.is_member_of(organization_id) AND status = 'DRAFT');
CREATE POLICY "Members delete campaigns" ON public.campaigns
    FOR DELETE USING (public.is_member_of(organization_id) AND status IN ('DRAFT','BLOCKED','FAILED'));

DROP POLICY IF EXISTS "Members view campaign recipients" ON public.campaign_recipients;
-- Read-only to clients. Rows are created by the queue RPC and mutated only by
-- the worker, so the unsubscribe_token is never client-writable.
CREATE POLICY "Members view campaign recipients" ON public.campaign_recipients
    FOR SELECT USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "Members view suppressions"   ON public.email_suppressions;
DROP POLICY IF EXISTS "Members insert suppressions" ON public.email_suppressions;
DROP POLICY IF EXISTS "Members delete suppressions" ON public.email_suppressions;

CREATE POLICY "Members view suppressions" ON public.email_suppressions
    FOR SELECT USING (public.is_member_of(organization_id));
-- A merchant may manually suppress an address, and may remove a MANUAL entry.
-- They may NOT delete an UNSUBSCRIBED/BOUNCED/COMPLAINED row — overriding a
-- recipient's unsubscribe is both a legal problem and a reputation problem.
CREATE POLICY "Members insert suppressions" ON public.email_suppressions
    FOR INSERT WITH CHECK (public.is_member_of(organization_id) AND reason = 'MANUAL');
CREATE POLICY "Members delete suppressions" ON public.email_suppressions
    FOR DELETE USING (public.is_member_of(organization_id) AND reason = 'MANUAL');


-- -----------------------------------------------------------------------------
-- check_campaign_quota
--
-- Pro-only, 250 campaign emails per calendar month, and at most 2 campaigns in
-- any rolling 7 days.
--
-- The frequency limit is not arbitrary. A monthly volume cap does nothing to
-- stop someone mailing their entire list every few days, which is precisely the
-- pattern that gets a young sending domain blocked. It also protects the domain
-- during its warm-up period.
--
-- Returns a JSONB verdict rather than raising, so the UI can show remaining
-- allowance before the user writes anything.
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
    v_org_id          uuid;
    v_is_pro          boolean;
    v_pro_expires     timestamptz;
    v_month_start     timestamptz := date_trunc('month', now());
    v_sent_this_month integer;
    v_recent_campaigns integer;
    c_monthly_cap     CONSTANT integer := 250;
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

    SELECT is_pro, pro_expires_at INTO v_is_pro, v_pro_expires
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

    IF v_recent_campaigns >= c_weekly_campaigns THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'FREQUENCY_LIMIT',
            'monthlyCap', c_monthly_cap,
            'sentThisMonth', v_sent_this_month,
            'remaining', GREATEST(c_monthly_cap - v_sent_this_month, 0),
            'campaignsThisWeek', v_recent_campaigns,
            'message', format('You have already sent %s campaigns in the last 7 days. Sending more often than this harms your delivery rate, so the limit is %s per week.',
                              v_recent_campaigns, c_weekly_campaigns));
    END IF;

    IF v_sent_this_month + GREATEST(p_recipient_count, 0) > c_monthly_cap THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'MONTHLY_CAP',
            'monthlyCap', c_monthly_cap,
            'sentThisMonth', v_sent_this_month,
            'remaining', GREATEST(c_monthly_cap - v_sent_this_month, 0),
            'message', format('This campaign needs %s emails but only %s of your %s monthly allowance remain.',
                              p_recipient_count, GREATEST(c_monthly_cap - v_sent_this_month, 0), c_monthly_cap));
    END IF;

    RETURN jsonb_build_object('allowed', true,
        'monthlyCap', c_monthly_cap,
        'sentThisMonth', v_sent_this_month,
        'remaining', GREATEST(c_monthly_cap - v_sent_this_month, 0),
        'campaignsThisWeek', v_recent_campaigns,
        'weeklyCampaignCap', c_weekly_campaigns);
END;
$$;

ALTER FUNCTION public.check_campaign_quota(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_campaign_quota(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_campaign_quota(integer) TO authenticated;


-- -----------------------------------------------------------------------------
-- unsubscribe_by_token
--
-- Called by the public unsubscribe page with the anon key. Idempotent: a second
-- click (or a mail client pre-fetching the link) must not error.
--
-- Deliberately returns only a boolean-ish payload and never reveals the email
-- address or organization, so the token cannot be used to enumerate contacts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unsubscribe_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec record;
BEGIN
    IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
        RETURN jsonb_build_object('success', false, 'message', 'That unsubscribe link is not valid.');
    END IF;

    SELECT cr.id, cr.organization_id, cr.email, cr.campaign_id
      INTO v_rec
      FROM public.campaign_recipients cr
     WHERE cr.unsubscribe_token = p_token
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'That unsubscribe link is not valid or has expired.');
    END IF;

    INSERT INTO public.email_suppressions (organization_id, email, reason, detail)
    VALUES (v_rec.organization_id, lower(v_rec.email), 'UNSUBSCRIBED',
            'Unsubscribed via campaign link')
    ON CONFLICT (organization_id, email) DO NOTHING;

    UPDATE public.campaigns
       SET unsubscribed_count = unsubscribed_count + 1,
           updated_at = now()
     WHERE id = v_rec.campaign_id;

    RETURN jsonb_build_object('success', true,
        'message', 'You have been unsubscribed and will not receive further marketing emails from this business.');
END;
$$;

ALTER FUNCTION public.unsubscribe_by_token(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.unsubscribe_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_by_token(text) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- record_email_suppression
--
-- Used by the Resend webhook for bounces and spam complaints. Without this,
-- every campaign re-sends to dead addresses and the complaint rate keeps
-- climbing — which is how a sending domain gets blocked.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_email_suppression(
    p_org_id uuid,
    p_email  text,
    p_reason text,
    p_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_reason NOT IN ('UNSUBSCRIBED','BOUNCED','COMPLAINED','MANUAL') THEN
        RAISE EXCEPTION 'Invalid suppression reason: %', p_reason;
    END IF;

    INSERT INTO public.email_suppressions (organization_id, email, reason, detail)
    VALUES (p_org_id, lower(btrim(p_email)), p_reason, p_detail)
    ON CONFLICT (organization_id, email) DO UPDATE
       SET reason = EXCLUDED.reason,
           detail = EXCLUDED.detail;
END;
$$;

ALTER FUNCTION public.record_email_suppression(uuid, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_email_suppression(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_email_suppression(uuid, text, text, text) TO service_role;

-- -----------------------------------------------------------------------------
-- queue_campaign
--
-- The only way a campaign enters the send queue. Does everything that must not
-- be left to the client:
--   * re-checks the quota server-side (the UI check is a courtesy, not a gate)
--   * expands the chosen client ids into recipient rows
--   * drops addresses on the suppression list, and anyone with no email
--   * mints a per-recipient unsubscribe token (via the column default)
--   * refuses to queue if the proofread gate reported blocking issues
--
-- Recipients cannot be inserted by the client at all — `campaign_recipients`
-- has only a SELECT policy — because the unsubscribe token is a credential on
-- a public endpoint and must never be client-chosen.
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

    -- Never queue content that failed the deterministic proofread checks.
    IF p_proofread IS NOT NULL THEN
        SELECT COALESCE(jsonb_array_length(p_proofread -> 'blocking'), 0) INTO v_blocking;
        IF v_blocking > 0 THEN
            RETURN jsonb_build_object('success', false, 'reason', 'PROOFREAD_BLOCKED',
                'message', 'This campaign has issues that would likely get it blocked or marked as spam. Resolve them and try again.',
                'report', p_proofread);
        END IF;
    END IF;

    -- Work out who is actually mailable before spending quota on them.
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
        'quota', v_quota,
        'message', format('Campaign queued for %s recipients.', v_eligible));
END;
$$;

ALTER FUNCTION public.queue_campaign(text, text, text, text, jsonb, text[], jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.queue_campaign(text, text, text, text, jsonb, text[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_campaign(text, text, text, text, jsonb, text[], jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- bump_campaign_counter
--
-- Increments one of the denormalised counters on `campaigns`, resolved from a
-- recipient row. Used by the Resend event webhook so the dashboard can show
-- bounce and complaint totals without an aggregate query per campaign.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_campaign_counter(
    p_recipient_id uuid,
    p_counter      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_campaign_id uuid;
BEGIN
    IF p_counter NOT IN ('bounced', 'complained', 'unsubscribed', 'failed') THEN
        RAISE EXCEPTION 'Unknown campaign counter: %', p_counter;
    END IF;

    SELECT campaign_id INTO v_campaign_id
      FROM public.campaign_recipients
     WHERE id = p_recipient_id;

    IF v_campaign_id IS NULL THEN
        RETURN;
    END IF;

    -- Explicit branches rather than dynamic SQL: the column name comes from a
    -- caller, and a fixed allow-list plus static statements removes any
    -- injection surface entirely.
    IF p_counter = 'bounced' THEN
        UPDATE public.campaigns SET bounced_count = bounced_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    ELSIF p_counter = 'complained' THEN
        UPDATE public.campaigns SET complained_count = complained_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    ELSIF p_counter = 'unsubscribed' THEN
        UPDATE public.campaigns SET unsubscribed_count = unsubscribed_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    ELSIF p_counter = 'failed' THEN
        UPDATE public.campaigns SET failed_count = failed_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    END IF;
END;
$$;

ALTER FUNCTION public.bump_campaign_counter(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bump_campaign_counter(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_campaign_counter(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
