-- =============================================================================
-- 20261012000000_payment_events_ledger.sql
--
-- Fixes installment payments, and makes gateway webhooks idempotent.
--
-- THE BUG
-- Checkout charges the OUTSTANDING BALANCE (`total - amount_paid`), not the
-- full total. The webhooks then did:
--
--     status      = (paid >= invoice.total) ? 'PAID' : 'PARTIAL'
--     amount_paid = paid
--
-- So for a 10,000 invoice already 4,000 paid, the customer pays the remaining
-- 6,000 and the webhook compares 600000 >= 1000000 (false), marks it PARTIAL,
-- and OVERWRITES amount_paid with 600000 — silently discarding the earlier
-- 400000. An invoice settled in installments could never reach PAID, and the
-- recorded total was only ever the most recent installment.
--
-- THE FIX
-- `amount_paid` must ACCUMULATE. But accumulation alone is unsafe, because
-- gateways retry webhooks and a replay would double-count. So every gateway
-- payment is first recorded in a ledger keyed UNIQUE on (gateway, reference).
-- If the insert is a no-op the event was already processed and we return
-- without touching the invoice. Replay-safe accumulation.
--
-- Note this is the opposite of the public RPC, where `amount_paid` is
-- deliberately idempotent-by-assignment — there the untrusted browser was
-- sending the full total on every call. Here the gateway reports the actual
-- amount captured, which is genuinely additive.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invoice_local_id text NOT NULL,
    gateway          text NOT NULL,
    reference        text NOT NULL,
    amount_minor     bigint NOT NULL,
    currency         text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    -- The idempotency guard. A gateway reference is unique per captured
    -- transaction, so a replayed webhook collides here and is ignored.
    CONSTRAINT payment_events_gateway_reference_key UNIQUE (gateway, reference)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_invoice
    ON public.payment_events (organization_id, invoice_local_id, created_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Members may read their own payment history (for a future payments ledger UI).
-- Writes happen only through the SECURITY DEFINER function below, called by
-- edge functions using the service role.
DROP POLICY IF EXISTS "Members can view payment events" ON public.payment_events;
CREATE POLICY "Members can view payment events" ON public.payment_events
    FOR SELECT USING (public.is_member_of(organization_id));


-- -----------------------------------------------------------------------------
-- record_payment_event
--
-- Records a captured gateway payment and reconciles the invoice.
-- Returns the invoice's resulting status, or 'DUPLICATE' when the event had
-- already been processed.
--
-- All amounts are MINOR units (kobo/cents), matching the BIGINT columns.
-- -----------------------------------------------------------------------------
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
    v_inserted   boolean := false;
    v_total      bigint;
    v_paid       bigint;
    v_new_status text;
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

    -- Already processed — a replayed webhook. Do not touch the invoice.
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

    -- ACCUMULATE. This is the actual installment fix.
    v_paid := v_paid + p_amount_minor;
    v_new_status := CASE WHEN v_paid >= v_total THEN 'PAID' ELSE 'PARTIAL' END;

    UPDATE public.invoices
       SET amount_paid = v_paid,
           status      = v_new_status,
           updated_at  = now()
     WHERE local_id = p_invoice_local_id
       AND organization_id = p_org_id;

    RETURN v_new_status;
END;
$$;

ALTER FUNCTION public.record_payment_event(uuid, text, text, text, bigint, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_payment_event(uuid, text, text, text, bigint, text) FROM PUBLIC;
-- Only the service role (edge functions) may record a payment. Never anon.
GRANT EXECUTE ON FUNCTION public.record_payment_event(uuid, text, text, text, bigint, text) TO service_role;

NOTIFY pgrst, 'reload schema';
