DO $$
BEGIN
  PERFORM cron.unschedule('email-worker-job');
EXCEPTION WHEN OTHERS THEN
  -- Ignore if it doesn't exist yet
END $$;

SELECT cron.schedule(
  'email-worker-job',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
        url:='https://tftgkvovzntfkymvbwdz.supabase.co/functions/v1/email-worker',
        headers:='{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
