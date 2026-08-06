-- Function to check quota before inserting invoice or quote
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
      SELECT COUNT(*) INTO v_doc_count FROM public.invoices WHERE user_id = NEW.user_id;
    ELSIF TG_TABLE_NAME = 'quotes' THEN
      SELECT COUNT(*) INTO v_doc_count FROM public.quotes WHERE user_id = NEW.user_id;
    END IF;
    
    IF v_doc_count >= 10 THEN
      RAISE EXCEPTION 'Free tier limit reached. You can only create up to 10 %.', TG_TABLE_NAME;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_invoice_quota ON public.invoices;
CREATE TRIGGER enforce_invoice_quota
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION check_user_quota();

DROP TRIGGER IF EXISTS enforce_quote_quota ON public.quotes;
CREATE TRIGGER enforce_quote_quota
BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION check_user_quota();
