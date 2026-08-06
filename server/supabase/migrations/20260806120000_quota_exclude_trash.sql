-- Function to check quota before inserting invoice or quote, ignoring trash (deleted_at IS NOT NULL)
CREATE OR REPLACE FUNCTION check_user_quota()
RETURNS TRIGGER AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_doc_count INT;
BEGIN
  -- Get user profile
  SELECT is_pro INTO v_is_pro FROM public.profiles WHERE id = NEW.user_id;
  
  IF NOT v_is_pro THEN
    IF TG_TABLE_NAME = 'invoices' THEN
      -- Count active invoices
      SELECT COUNT(*) INTO v_doc_count FROM public.invoices WHERE user_id = NEW.user_id AND deleted_at IS NULL;
    ELSIF TG_TABLE_NAME = 'quotes' THEN
      -- Count active quotes
      SELECT COUNT(*) INTO v_doc_count FROM public.quotes WHERE user_id = NEW.user_id AND deleted_at IS NULL;
    END IF;
    
    IF v_doc_count >= 10 THEN
      RAISE EXCEPTION 'Free tier limit reached. You can only have up to 10 active %.', TG_TABLE_NAME;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
