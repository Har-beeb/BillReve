-- Dynamically drop all versions of the function to clear out any hidden overloads

DO $$ 
DECLARE 
    func_record record;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc 
        WHERE proname = 'update_invoice_status_public' 
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE;';
    END LOOP;
END $$;

-- Now recreate only the one correct version
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
    IF p_status NOT IN ('PENDING', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT', 'PARTIAL') THEN
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
        amount_paid = COALESCE(amount_paid, 0) + COALESCE(p_amount_paid, 0),
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$;
