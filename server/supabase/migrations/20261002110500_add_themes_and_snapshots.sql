-- Add theme to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'standard';

-- Add theme to quotes
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'standard';

-- Add bank_account_snapshot to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS bank_account_snapshot JSONB DEFAULT NULL;
