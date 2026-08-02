-- Add flutterwave_public_key to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'flutterwave_public_key') THEN
        ALTER TABLE public.profiles ADD COLUMN flutterwave_public_key TEXT;
    END IF;
END $$;

-- Create user_secrets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_secrets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    paystack_secret_key TEXT,
    flutterwave_secret_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_secrets
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

-- Safely recreate policies
DROP POLICY IF EXISTS "Users can view own secrets" ON public.user_secrets;
DROP POLICY IF EXISTS "Users can insert own secrets" ON public.user_secrets;
DROP POLICY IF EXISTS "Users can update own secrets" ON public.user_secrets;

CREATE POLICY "Users can view own secrets" ON public.user_secrets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own secrets" ON public.user_secrets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own secrets" ON public.user_secrets FOR UPDATE USING (auth.uid() = user_id);

-- Ensure service role has full access (for webhooks)
GRANT ALL ON TABLE public.user_secrets TO service_role;
GRANT ALL ON TABLE public.user_secrets TO authenticated;
