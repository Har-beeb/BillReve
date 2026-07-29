-- Enable realtime for the tables that the frontend listens to
BEGIN;
  -- Remove them first if they exist to prevent errors, though adding them is idempotent in newer Postgres versions
  -- But we can just use the standard alter publication
  
  -- Create publication if it doesn't exist (Supabase creates it by default, but just in case)
  -- DO $$
  -- BEGIN
  --   IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
  --     CREATE PUBLICATION supabase_realtime;
  --   END IF;
  -- END
  -- $$;

  ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
COMMIT;
