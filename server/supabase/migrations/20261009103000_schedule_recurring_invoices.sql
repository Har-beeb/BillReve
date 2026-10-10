-- Schedule the recurring invoices worker to run every day at midnight (00:01 AM)

DO $$
BEGIN
  PERFORM cron.unschedule('process-recurring-invoices-job');
EXCEPTION WHEN OTHERS THEN
  -- Ignore if it doesn't exist yet
END $$;

SELECT cron.schedule(
  'process-recurring-invoices-job',
  '1 0 * * *',
  $$
    SELECT net.http_post(
        url:='https://tftgkvovzntfkymvbwdz.supabase.co/functions/v1/process-recurring-invoices',
        headers:='{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
