-- Add industry and business_description to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS business_description TEXT;

-- Reload schema cache to ensure API immediately recognizes new columns
NOTIFY pgrst, 'reload schema';
