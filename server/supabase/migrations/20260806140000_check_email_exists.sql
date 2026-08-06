-- Function to securely check if an email exists without exposing user data
CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Need to bypass RLS to check auth.users directly
  -- Security Definer ensures it runs as postgres superuser
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only authenticated users and anon users can execute this function
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO authenticated, anon;
