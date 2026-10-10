-- Fix overloaded update_invoice_status_public RPC

-- Drop all existing variants to avoid ambiguity
DROP FUNCTION IF EXISTS public.update_invoice_status_public(text, text, numeric);
DROP FUNCTION IF EXISTS public.update_invoice_status_public(text, text, numeric, numeric, text);

-- Create the correct, single variant
CREATE OR REPLACE FUNCTION public.update_invoice_status_public(
    p_local_id text, 
    p_status text, 
    p_amount_paid numeric DEFAULT NULL::numeric
) 
RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_target_invoice record;
BEGIN
    -- Validate Status Allow-list for PUBLIC access
    -- A public user cannot set an invoice to PAID directly. That must come from the webhook or the merchant.
    IF p_status NOT IN ('PENDING', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT', 'PARTIAL') THEN
        RAISE EXCEPTION 'Invalid public invoice status transition';
    END IF;

    -- Note: check_rate_limit was introduced to prevent spamming
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
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$;
