-- Enable the pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- We need to ensure that the cron extension is set up in a database that supports it.
-- Supabase supports pg_cron natively. We can schedule a job.

-- NOTE: Replace 'YOUR_PROJECT_REF' with the actual Supabase project ref in production.
-- To allow this to run dynamically, we would ideally use a webhook or pass the URL.
-- For local development, this URL might be different.
-- Supabase Edge Functions can be called internally via the Supabase API Gateway.

-- Drop the job if it exists to allow re-running this migration
SELECT cron.unschedule('email-worker-job');

-- Schedule the job to run every 5 minutes
-- We use pg_net to make an HTTP POST request to the Edge Function.
-- The URL will need to be configured based on the environment.
-- For now, this is a placeholder template that the user must update with their project ref.
-- Example: 'https://[PROJECT_REF].supabase.co/functions/v1/email-worker'

-- Since pg_net is asynchronous, it's perfect for this.
SELECT cron.schedule(
  'email-worker-job',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/email-worker',
        headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    );
  $$
);
