-- Migration: Create recurring_schedules table and RLS policies

CREATE TABLE IF NOT EXISTS public.recurring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    template_invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'YEARLY')),
    next_run_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cron job performance (filtering by next_run_date and status)
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_run_date 
ON public.recurring_schedules(next_run_date, status);

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_org_id 
ON public.recurring_schedules(organization_id);

-- Enable Row Level Security
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view recurring schedules in their organization"
    ON public.recurring_schedules FOR SELECT
    USING (public.is_member_of(organization_id));

CREATE POLICY "Users can create recurring schedules in their organization"
    ON public.recurring_schedules FOR INSERT
    WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "Users can update recurring schedules in their organization"
    ON public.recurring_schedules FOR UPDATE
    USING (public.is_member_of(organization_id))
    WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "Users can delete recurring schedules in their organization"
    ON public.recurring_schedules FOR DELETE
    USING (public.is_member_of(organization_id));

-- Updated At Trigger
CREATE TRIGGER update_recurring_schedules_modtime
    BEFORE UPDATE ON public.recurring_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Enable realtime replication for sync engine
ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_schedules;
