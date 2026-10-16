-- =============================================================================
-- 20261015000000_campaign_worker_cron_guard.sql
--
-- Reschedules the campaign worker cron job with an explicit precondition check.
--
-- WHY: the previous version interpolated two Vault lookups straight into
-- net.http_post(). When the secrets were absent, both resolved to NULL and the
-- job failed every minute with:
--
--   ERROR: null value in column "url" of relation "http_request_queue"
--          violates not-null constraint
--
-- That message never mentions Vault, so the actual cause — two missing secrets
-- — was invisible. Campaigns simply sat on QUEUED forever with no usable
-- diagnostic. A setup step that fails silently is a design defect, not a
-- user error.
--
-- The job now raises a message that names exactly what is missing, which lands
-- in cron.job_run_details.return_message where anyone debugging will see it.
--
-- PREREQUISITES (create once, before this job can do anything):
--   SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   SELECT vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
-- =============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('campaign-worker-job');
EXCEPTION WHEN OTHERS THEN
  -- Not scheduled; nothing to remove.
END $$;

SELECT cron.schedule(
  'campaign-worker-job',
  '* * * * *',
  $CRON$
  DO $inner$
  DECLARE
      v_url    text;
      v_secret text;
  BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'project_url';
      SELECT decrypted_secret INTO v_secret
        FROM vault.decrypted_secrets WHERE name = 'cron_secret';

      IF v_url IS NULL OR v_secret IS NULL THEN
          RAISE EXCEPTION
            'campaign-worker cron cannot run: missing Vault secret(s) %. Create them with vault.create_secret(...) — see migration 20261015000000.',
            CASE
              WHEN v_url IS NULL AND v_secret IS NULL THEN 'project_url and cron_secret'
              WHEN v_url IS NULL THEN 'project_url'
              ELSE 'cron_secret'
            END;
      END IF;

      PERFORM net.http_post(
          url     := v_url || '/functions/v1/campaign-worker',
          headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_secret
          ),
          body    := '{}'::jsonb
      );
  END
  $inner$;
  $CRON$
);
