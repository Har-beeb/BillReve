-- Prevent authenticated users from manipulating their own billing status
CREATE OR REPLACE FUNCTION public.protect_pro_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restrict changes if the user is calling this via the client API (authenticated role)
  -- Service role (used by our webhooks) can still update these fields.
  IF auth.role() = 'authenticated' THEN
    NEW.is_pro = OLD.is_pro;
    NEW.pro_expires_at = OLD.pro_expires_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow safe re-runs
DROP TRIGGER IF EXISTS enforce_pro_status_protection ON public.profiles;

-- Create the trigger
CREATE TRIGGER enforce_pro_status_protection
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.protect_pro_status();
