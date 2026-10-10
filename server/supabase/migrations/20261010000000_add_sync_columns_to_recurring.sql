-- Migration: Add sync_status, deleted_at, and is_purged to recurring_schedules
-- These are required by the offline-first sync engine

ALTER TABLE public.recurring_schedules
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_purged BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';