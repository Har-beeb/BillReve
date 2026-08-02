-- Migration V20: Add Public Read Policies for Public Links

-- 1. Ensure RLS is enabled
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view invoice by local_id" ON public.invoices;
DROP POLICY IF EXISTS "Anyone can view quote by local_id" ON public.quotes;
DROP POLICY IF EXISTS "Anyone can view profile by id" ON public.profiles;

-- 3. Create Public Read Policies
-- This allows anyone with the local_id to view an invoice or quote.
CREATE POLICY "Anyone can view invoice by local_id" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Anyone can view quote by local_id" ON public.quotes FOR SELECT USING (true);
CREATE POLICY "Anyone can view profile by id" ON public.profiles FOR SELECT USING (true);

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
