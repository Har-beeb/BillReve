-- 1. Drop the insecure policies that were causing data leaks
DROP POLICY IF EXISTS "Anyone can view invoice by local_id" ON public.invoices;
DROP POLICY IF EXISTS "Anyone can view quote by local_id" ON public.quotes;
DROP POLICY IF EXISTS "Anyone can view profile by id" ON public.profiles;

-- 2. Create secure RPC function for fetching a public invoice
CREATE OR REPLACE FUNCTION get_public_invoice(p_local_id TEXT)
RETURNS SETOF public.invoices
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.invoices WHERE local_id = p_local_id LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create secure RPC function for fetching a public quote
CREATE OR REPLACE FUNCTION get_public_quote(p_local_id TEXT)
RETURNS SETOF public.quotes
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.quotes WHERE local_id = p_local_id LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create secure RPC function for fetching a public profile
CREATE OR REPLACE FUNCTION get_public_profile(p_id UUID)
RETURNS SETOF public.profiles
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.profiles WHERE id = p_id LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create secure RPC function for fetching a public client
CREATE OR REPLACE FUNCTION get_public_client(p_local_id TEXT)
RETURNS SETOF public.clients
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.clients WHERE local_id = p_local_id LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_public_invoice(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_quote(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_client(TEXT) TO anon, authenticated;

-- 7. Reload schema cache
NOTIFY pgrst, 'reload schema';
