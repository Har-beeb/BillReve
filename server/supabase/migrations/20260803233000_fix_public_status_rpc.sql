-- Fix update_quote_status_public to only update provided fields (using COALESCE)
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

-- Fix update_invoice_status_public to add to amount_paid and coalesce other fields
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
