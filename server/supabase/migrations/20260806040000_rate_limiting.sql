CREATE TABLE IF NOT EXISTS rate_limits (
  user_id uuid REFERENCES auth.users(id) PRIMARY KEY,
  ai_count int DEFAULT 0,
  email_count int DEFAULT 0,
  reset_at timestamptz DEFAULT now() + interval '1 day'
);

-- RLS: Users can read their own limits (if needed) but cannot update them
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to automatically create a rate_limits row when a profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_rate_limit()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.rate_limits (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: we use profiles insert trigger as a proxy for new users since profiles are created automatically
DROP TRIGGER IF EXISTS on_profile_created_rate_limit ON public.profiles;
CREATE TRIGGER on_profile_created_rate_limit
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_rate_limit();

-- Backfill existing users
INSERT INTO public.rate_limits (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
