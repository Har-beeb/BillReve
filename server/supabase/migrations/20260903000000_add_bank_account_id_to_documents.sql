ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS bank_account_id TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS bank_account_id TEXT;

NOTIFY pgrst, 'reload schema';
