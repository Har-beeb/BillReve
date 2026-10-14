-- =============================================================================
-- 20261014030000_schedule_campaign_worker.sql
--
-- Runs the campaign send worker every minute.
--
-- Queueing a campaign only creates rows; this is what actually sends them. A
-- one-minute cadence makes a send feel immediate to the user while keeping each
-- invocation small (the worker caps itself at 5 batches of 100 per run, then
-- exits and resumes on the next tick — so a large campaign drains steadily
-- instead of risking the edge function wall clock).
--
-- SECRETS
-- Unlike the recurring-invoices job, `campaign-worker` is authenticated: it can
-- spend real money and touch every tenant's data, so it refuses any request
-- without `Authorization: Bearer <CRON_SECRET>`.
--
-- The secret is read from Supabase Vault rather than written into this file,
-- because migrations are committed to git. Before applying, create the two
-- secrets once (SQL editor, or Dashboard → Settings → Vault):
--
--   SELECT vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url');
--   SELECT vault.create_secret('<the same value as the CRON_SECRET function secret>', 'cron_secret');
--
-- If either is missing the job will error on each tick and log it, rather than
-- silently sending nothing — check `cron.job_run_details` if campaigns stay
-- QUEUED.
-- =============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('campaign-worker-job');
EXCEPTION WHEN OTHERS THEN
  -- Not scheduled yet; nothing to remove.
END $$;

SELECT cron.schedule(
  'campaign-worker-job',
  '* * * * *',
  $$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/campaign-worker',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' ||
                (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb
    );
  $$
);
