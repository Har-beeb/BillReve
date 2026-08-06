-- Add JSONB column for multiple bank accounts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_accounts JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single bank accounts into the new JSONB column
UPDATE public.profiles
SET bank_accounts = jsonb_build_array(
  jsonb_build_object(
    'id', 'default',
    'bankName', bank_name,
    'accountName', account_name,
    'accountNumber', account_number,
    'isDefault', true
  )
)
WHERE bank_name IS NOT NULL AND bank_name != '';

-- (Optional) We leave the old columns (bank_name, account_name, account_number) intact for now 
-- to prevent breaking any clients that haven't refreshed to the latest code yet.
