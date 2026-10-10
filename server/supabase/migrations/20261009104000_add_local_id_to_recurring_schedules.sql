-- Add local_id to recurring_schedules
ALTER TABLE public.recurring_schedules ADD COLUMN IF NOT EXISTS local_id TEXT;

-- Populate existing rows (if any)
UPDATE public.recurring_schedules SET local_id = id::text WHERE local_id IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE public.recurring_schedules ALTER COLUMN local_id SET NOT NULL;

-- Add unique constraint for sync upsert
ALTER TABLE public.recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_org_id_local_id_key;
ALTER TABLE public.recurring_schedules ADD CONSTRAINT recurring_schedules_org_id_local_id_key UNIQUE (organization_id, local_id);

-- Drop the existing foreign keys on client_id and template_invoice_id
ALTER TABLE public.recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_client_id_fkey;
ALTER TABLE public.recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_template_invoice_id_fkey;

-- Change columns to TEXT to store frontend localIds
ALTER TABLE public.recurring_schedules ALTER COLUMN client_id TYPE TEXT USING client_id::text;
ALTER TABLE public.recurring_schedules ALTER COLUMN template_invoice_id TYPE TEXT USING template_invoice_id::text;

-- Re-add foreign keys pointing to local_id instead of Postgres id
ALTER TABLE public.recurring_schedules 
  ADD CONSTRAINT recurring_schedules_client_local_id_fkey 
  FOREIGN KEY (organization_id, client_id) 
  REFERENCES public.clients(organization_id, local_id) 
  ON DELETE CASCADE;

ALTER TABLE public.recurring_schedules 
  ADD CONSTRAINT recurring_schedules_template_local_id_fkey 
  FOREIGN KEY (organization_id, template_invoice_id) 
  REFERENCES public.invoices(organization_id, local_id) 
  ON DELETE CASCADE;

-- Notify postgrest to reload the schema cache so the API immediately recognizes local_id
NOTIFY pgrst, 'reload schema';
