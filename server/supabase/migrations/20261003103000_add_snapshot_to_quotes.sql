-- Add bank_account_snapshot to quotes table
-- (invoices already has this from 20261002110500_add_themes_and_snapshots.sql)
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS bank_account_snapshot JSONB DEFAULT NULL;

-- Reload schema cache so PostgREST recognises both new columns
NOTIFY pgrst, 'reload schema';
