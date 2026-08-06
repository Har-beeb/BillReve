-- Enable the pg_cron extension if it's not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the function that will perform the trash cleanup
CREATE OR REPLACE FUNCTION empty_trash_based_on_plan()
RETURNS void AS $$
BEGIN
  -- Delete old invoices
  DELETE FROM public.invoices i
  USING public.profiles p
  WHERE i.user_id = p.id 
  AND i.deleted_at IS NOT NULL 
  AND (
    (p.is_pro = false AND i.deleted_at < NOW() - INTERVAL '7 days') OR
    (p.is_pro = true AND i.deleted_at < NOW() - INTERVAL '30 days')
  );

  -- Delete old quotes
  DELETE FROM public.quotes q
  USING public.profiles p
  WHERE q.user_id = p.id 
  AND q.deleted_at IS NOT NULL 
  AND (
    (p.is_pro = false AND q.deleted_at < NOW() - INTERVAL '7 days') OR
    (p.is_pro = true AND q.deleted_at < NOW() - INTERVAL '30 days')
  );

  -- Delete old clients
  DELETE FROM public.clients c
  USING public.profiles p
  WHERE c.user_id = p.id 
  AND c.deleted_at IS NOT NULL 
  AND (
    (p.is_pro = false AND c.deleted_at < NOW() - INTERVAL '7 days') OR
    (p.is_pro = true AND c.deleted_at < NOW() - INTERVAL '30 days')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove existing schedule if it exists to prevent errors on multiple runs
SELECT cron.unschedule('empty-trash-daily');

-- Schedule the cron job to run daily at midnight
SELECT cron.schedule(
  'empty-trash-daily',
  '0 0 * * *', -- Everyday at midnight
  $$ SELECT empty_trash_based_on_plan(); $$
);
