-- Clean up any existing base64 data to prevent constraint violation errors
UPDATE public.profiles 
SET logo_url = NULL 
WHERE logo_url LIKE 'data:image%';

-- Add a CHECK constraint to ensure future logo_urls are not base64 strings
ALTER TABLE public.profiles 
  ADD CONSTRAINT chk_logo_url_no_base64 
  CHECK (logo_url IS NULL OR logo_url NOT LIKE 'data:image%');
