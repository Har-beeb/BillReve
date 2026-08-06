-- Add missing columns to profiles table that are requested by the frontend
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Reload schema cache to ensure API immediately recognizes new columns
NOTIFY pgrst, 'reload schema';
