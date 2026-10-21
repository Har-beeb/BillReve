-- =============================================================================
-- 20261021000000_campaign_retry.sql
--
-- Adds a retry path for failed campaigns, and surfaces WHY a send failed.
--
-- THE GAPS THIS CLOSES
--   1. A campaign that ended FAILED or PARTIAL could not be retried from the UI
--      at all — the only recovery was to compose it again from scratch.
--   2. The failure reason lived only on individual campaign_recipients rows, so
--      the history table showed a red "FAILED" with no explanation. The most
--      common real cause (Resend rejecting the `from` address because the
--      sending domain is not verified) was therefore invisible.
--
-- A campaign-level `last_error` column is added and populated by the worker, so
-- one glance at history tells the user what went wrong.
--
-- `retry_campaign` resets only FAILED recipients back to PENDING. SUPPRESSED
-- recipients (unsubscribed or bounced) are deliberately left alone — retrying a
-- send to someone who unsubscribed is both a legal problem and the fastest way
-- to earn a spam complaint. Already-SENT recipients are never re-sent.
-- =============================================================================

ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS last_error text;

-- -----------------------------------------------------------------------------
-- retry_campaign
--
-- Requeues a FAILED or PARTIAL campaign: FAILED recipients go back to PENDING,
-- the campaign returns to QUEUED, and the worker (triggered by the client or
-- the next cron tick) picks it up again.
--
-- Returns the number of recipients requeued, or an error reason.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retry_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id   uuid;
    v_status   text;
    v_requeued integer;
BEGIN
    SELECT organization_id, status
      INTO v_org_id, v_status
      FROM public.campaigns
     WHERE id = p_campaign_id;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Campaign not found.');
    END IF;

    -- Authorisation: the caller must belong to the campaign's organization.
    -- SECURITY DEFINER bypasses RLS, so this check is doing the work RLS would.
    IF NOT public.is_member_of(v_org_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorised.');
    END IF;

    IF v_status NOT IN ('FAILED', 'PARTIAL') THEN
        RETURN jsonb_build_object('success', false,
            'message', format('Only failed or partially-sent campaigns can be retried (this one is %s).', v_status));
    END IF;

    UPDATE public.campaign_recipients
       SET status = 'PENDING',
           error = NULL
     WHERE campaign_id = p_campaign_id
       AND status = 'FAILED';

    GET DIAGNOSTICS v_requeued = ROW_COUNT;

    IF v_requeued = 0 THEN
        RETURN jsonb_build_object('success', false,
            'message', 'There are no failed recipients to retry. Anyone not reached either unsubscribed or had a bad address.');
    END IF;

    UPDATE public.campaigns
       SET status = 'QUEUED',
           last_error = NULL,
           queued_at = now(),
           updated_at = now()
     WHERE id = p_campaign_id;

    RETURN jsonb_build_object('success', true,
        'requeued', v_requeued,
        'message', format('Requeued %s recipient(s). Sending will resume shortly.', v_requeued));
END;
$$;

ALTER FUNCTION public.retry_campaign(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.retry_campaign(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_campaign(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
