-- Rollback Pre-Launch Fixes
-- This migration undoes all database changes made during the pre-launch phase.

-- 1. Revert: 20260806080000_updated_at_triggers.sql
DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
DROP TRIGGER IF EXISTS set_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS set_quotes_updated_at ON public.quotes;
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- 2. Revert: 20260806050000_multiple_bank_accounts.sql
ALTER TABLE public.profiles DROP COLUMN IF EXISTS bank_accounts;

-- 3. Revert: 20260806040000_rate_limiting.sql
DROP TRIGGER IF EXISTS on_profile_created_rate_limit ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_new_user_rate_limit();
DROP TABLE IF EXISTS public.rate_limits;

-- 4. Revert: 20260805210001_create_logos_bucket.sql
-- We remove the policies, but keep the bucket to avoid errors if it contains files.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own logos" ON storage.objects;

-- 5. Revert: 20260805210000_add_pro_expires_at.sql
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pro_expires_at;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
