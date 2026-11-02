-- Authenticate the scheduled email-worker invocation.
--
-- The original email-worker cron job sent an unauthenticated POST request,
-- allowing anyone who discovered the public function URL to trigger processing
-- for every organization. Keep the secret in Vault and the Edge Function
-- secret; never commit its value here.

DO $$
BEGIN
  PERFORM cron.unschedule('email-worker-job');
EXCEPTION WHEN OTHERS THEN
  -- The job may not exist in a fresh environment.
END $$;

SELECT cron.schedule(
  'email-worker-job',
  '*/5 * * * *',
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
            'email-worker cron cannot run: missing Vault secret(s) %. Create them with vault.create_secret(...) — see migration 20261102090000.',
            CASE
              WHEN v_url IS NULL AND v_secret IS NULL THEN 'project_url and cron_secret'
              WHEN v_url IS NULL THEN 'project_url'
              ELSE 'cron_secret'
            END;
      END IF;

      PERFORM net.http_post(
          url     := v_url || '/functions/v1/email-worker',
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
