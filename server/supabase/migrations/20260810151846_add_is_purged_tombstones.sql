-- Add is_purged boolean column to support Tombstone (Delta Sync) logic
-- Devices can pull these tombstone records and delete them locally

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_purged boolean DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_purged boolean DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS is_purged boolean DEFAULT false;
