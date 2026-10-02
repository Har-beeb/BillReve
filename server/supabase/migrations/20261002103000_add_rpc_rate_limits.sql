CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON public.rate_limits (identifier, action, attempted_at DESC);

-- Auto-cleanup: delete entries older than 1 hour
CREATE OR REPLACE FUNCTION public.clean_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE attempted_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check rate limit helper
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_minutes INT DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INT;
BEGIN
  -- Clean old entries opportunistically (1% chance per call)
  IF random() < 0.01 THEN
    PERFORM public.clean_old_rate_limits();
  END IF;

  -- Count recent attempts
  SELECT COUNT(*) INTO attempt_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  -- If over limit, reject
  IF attempt_count >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  -- Log this attempt
  INSERT INTO public.rate_limits (identifier, action)
  VALUES (p_identifier, p_action);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix update_quote_status_public with rate limit check
CREATE OR REPLACE FUNCTION public.update_quote_status_public(
    p_local_id text,
    p_status text,
    p_counter_amount numeric DEFAULT NULL,
    p_client_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_quote record;
BEGIN
    IF NOT public.check_rate_limit(p_local_id, 'quote_status', 5, 10) THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
    END IF;

    SELECT * INTO v_target_quote 
    FROM public.quotes 
    WHERE local_id = p_local_id;

    IF v_target_quote IS NULL THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    UPDATE public.quotes 
    SET 
        status = COALESCE(p_status, status),
        counter_amount = COALESCE(p_counter_amount, counter_amount),
        client_message = COALESCE(p_client_message, client_message),
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$;

-- Fix update_invoice_status_public with rate limit check
CREATE OR REPLACE FUNCTION public.update_invoice_status_public(
    p_local_id text,
    p_status text,
    p_amount_paid numeric DEFAULT NULL,
    p_counter_amount numeric DEFAULT NULL,
    p_client_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_invoice record;
BEGIN
    IF NOT public.check_rate_limit(p_local_id, 'invoice_status', 5, 10) THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
    END IF;

    SELECT * INTO v_target_invoice 
    FROM public.invoices 
    WHERE local_id = p_local_id;

    IF v_target_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    UPDATE public.invoices 
    SET 
        status = COALESCE(p_status, status),
        amount_paid = COALESCE(amount_paid, 0) + COALESCE(p_amount_paid, 0),
        counter_amount = COALESCE(p_counter_amount, counter_amount),
        client_message = COALESCE(p_client_message, client_message),
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$;

-- Grant EXECUTE to anon and authenticated
GRANT EXECUTE ON FUNCTION public.update_quote_status_public(text, text, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_status_public(text, text, numeric, numeric, text) TO anon, authenticated;
