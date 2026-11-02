-- Keep the payment ledger's captured amount intact while preventing
-- invoices.amount_paid from exceeding the invoice total.

CREATE OR REPLACE FUNCTION public.record_payment_event(
    p_org_id           uuid,
    p_invoice_local_id text,
    p_gateway          text,
    p_reference        text,
    p_amount_minor     bigint,
    p_currency         text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inserted      boolean := false;
    v_total         bigint;
    v_paid          bigint;
    v_applied       bigint;
    v_new_status    text;
BEGIN
    IF p_reference IS NULL OR btrim(p_reference) = '' THEN
        RAISE EXCEPTION 'A gateway reference is required for idempotency';
    END IF;

    IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive, got %', p_amount_minor;
    END IF;

    INSERT INTO public.payment_events (
        organization_id, invoice_local_id, gateway, reference, amount_minor, currency
    )
    VALUES (
        p_org_id, p_invoice_local_id, p_gateway, p_reference, p_amount_minor, p_currency
    )
    ON CONFLICT (gateway, reference) DO NOTHING;

    v_inserted := FOUND;
    IF NOT v_inserted THEN
        RETURN 'DUPLICATE';
    END IF;

    SELECT total, COALESCE(amount_paid, 0)
      INTO v_total, v_paid
      FROM public.invoices
     WHERE local_id = p_invoice_local_id
       AND organization_id = p_org_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found for organization %', p_invoice_local_id, p_org_id;
    END IF;

    v_applied := LEAST(p_amount_minor, GREATEST(v_total - v_paid, 0));
    v_paid := v_paid + v_applied;
    v_new_status := CASE WHEN v_paid >= v_total THEN 'PAID' ELSE 'PARTIAL' END;

    UPDATE public.invoices
       SET amount_paid = v_paid,
           status = v_new_status,
           updated_at = now()
     WHERE local_id = p_invoice_local_id
       AND organization_id = p_org_id;

    RETURN v_new_status;
END;
$$;

ALTER FUNCTION public.record_payment_event(uuid, text, text, text, bigint, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_payment_event(uuid, text, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_event(uuid, text, text, text, bigint, text) TO service_role;
