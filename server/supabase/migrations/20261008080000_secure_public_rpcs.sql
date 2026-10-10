-- Fix check_rate_limit to use inet_client_addr() and set search_path
CREATE OR REPLACE FUNCTION public.clean_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE attempted_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_minutes INT DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INT;
  v_client_ip TEXT;
  v_rate_limit_key TEXT;
BEGIN
  -- Get client IP via Supabase PostgREST header fallback to inet_client_addr
  v_client_ip := COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', inet_client_addr()::text, 'unknown');
  
  -- Combine IP and identifier for the true rate limit key to prevent targeted DoS
  v_rate_limit_key := v_client_ip || ':' || p_identifier;

  -- Clean old entries opportunistically (1% chance per call)
  IF random() < 0.01 THEN
    PERFORM public.clean_old_rate_limits();
  END IF;

  -- Count recent attempts for this IP + Document combination
  SELECT COUNT(*) INTO attempt_count
  FROM public.rate_limits
  WHERE identifier = v_rate_limit_key
    AND action = p_action
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  -- If over limit, reject
  IF attempt_count >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  -- Log this attempt
  INSERT INTO public.rate_limits (identifier, action)
  VALUES (v_rate_limit_key, p_action);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Fix update_quote_status_public
CREATE OR REPLACE FUNCTION public.update_quote_status_public(
    p_local_id text,
    p_status text,
    p_counter_amount numeric DEFAULT NULL,
    p_client_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_quote record;
BEGIN
    -- Validate Status Allow-list
    IF p_status NOT IN ('ACCEPTED', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT') THEN
        RAISE EXCEPTION 'Invalid quote status transition';
    END IF;

    IF NOT public.check_rate_limit(p_local_id, 'quote_status', 5, 10) THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
    END IF;

    SELECT * INTO v_target_quote 
    FROM public.quotes 
    WHERE local_id = p_local_id;

    IF v_target_quote IS NULL THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    -- Enforce minimum counter amount based on the database record, not client trust
    IF p_status = 'COUNTERED' AND p_counter_amount IS NOT NULL THEN
        IF v_target_quote.allow_counter_offer = false THEN
            RAISE EXCEPTION 'Counter offers are not allowed for this quote';
        END IF;
        IF p_counter_amount < v_target_quote.minimum_counter_amount THEN
            RAISE EXCEPTION 'Counter offer is below the minimum allowed amount';
        END IF;
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


-- Fix update_invoice_status_public
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
SET search_path = public
AS $$
DECLARE
    v_target_invoice record;
BEGIN
    -- Validate Status Allow-list for PUBLIC access
    -- A public user cannot set an invoice to PAID directly. That must come from the webhook or the merchant.
    IF p_status NOT IN ('PENDING', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT') THEN
        RAISE EXCEPTION 'Invalid public invoice status transition';
    END IF;

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
        -- Make amount_paid idempotent! Do not allow double counting via additive logic.
        amount_paid = COALESCE(p_amount_paid, amount_paid),
        counter_amount = COALESCE(p_counter_amount, counter_amount),
        client_message = COALESCE(p_client_message, client_message),
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$;
