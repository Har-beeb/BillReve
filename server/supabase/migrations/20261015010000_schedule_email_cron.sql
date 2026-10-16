-- =============================================================================
-- 20261015010000_schedule_email_cron.sql
--
-- Schedules `email-cron`, which has NEVER RUN.
--
-- The function has existed for months and powers two advertised features:
--   * invoice payment reminders at -3, 0, +3, +7 and +14 days from the due date
--     ("Automated Reminders", listed as a Pro feature on the landing page, in
--     the README, and in the day-3 upsell email)
--   * the daily Pro-expiry sweep that sets is_pro = false once
--     pro_expires_at has passed — the failsafe for a missed SaaS webhook
--
-- Nothing ever invoked it. Of the jobs defined across all migrations there was
-- `email-worker-job`, `empty-trash-daily`, `process-recurring-invoices-job` and
-- `campaign-worker-job`, but no schedule for `email-cron`. So not a single
-- reminder has been sent, and lapsed Pro subscriptions have only been
-- downgraded when a webhook happened to fire.
--
-- A column-name bug in the function (`organizations.business_name`, fixed in
-- the 2026-10-13 round) masked this: it would have thrown on the first call,
-- which made "reminders don't work" look like a code fault rather than an
-- absent schedule.
--
-- TIMING: pg_cron evaluates in the database timezone, which is UTC on Supabase.
-- 07:00 UTC is 08:00 in Lagos — reminders land first thing in the morning
-- rather than at midnight.
--
-- AUTH: unlike `process-recurring-invoices`, this function checks CRON_SECRET,
-- so the job must send it. The secret is read from Vault rather than written
-- into this file, because migrations are committed. Same two secrets as the
-- campaign worker:
--   SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   SELECT vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
-- =============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('email-cron-job');
EXCEPTION WHEN OTHERS THEN
  -- Not scheduled yet; nothing to remove.
END $$;

SELECT cron.schedule(
  'email-cron-job',
  '0 7 * * *',
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

      -- Fail with a message that names the problem. The campaign worker job
      -- originally interpolated these lookups directly, and when the secrets
      -- were absent it failed every minute with
      -- 'null value in column "url"' — which never mentions Vault.
      IF v_url IS NULL OR v_secret IS NULL THEN
          RAISE EXCEPTION
            'email-cron cannot run: missing Vault secret(s) %. Create them with vault.create_secret(...) — see migration 20261015010000.',
            CASE
              WHEN v_url IS NULL AND v_secret IS NULL THEN 'project_url and cron_secret'
              WHEN v_url IS NULL THEN 'project_url'
              ELSE 'cron_secret'
            END;
      END IF;

      PERFORM net.http_post(
          url     := v_url || '/functions/v1/email-cron',
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
