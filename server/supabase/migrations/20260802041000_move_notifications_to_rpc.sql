-- Migration V18: Move Notifications to Public RPCs
-- This ensures notifications are ONLY fired when clients use the public link, NOT when the admin updates statuses in-app.

-- 1. Drop existing database triggers that fire on every update
DROP TRIGGER IF EXISTS on_quote_status_change ON public.quotes;
DROP TRIGGER IF EXISTS on_invoice_status_change ON public.invoices;

-- 2. Drop the old trigger functions
DROP FUNCTION IF EXISTS public.handle_quote_status_change();
DROP FUNCTION IF EXISTS public.handle_invoice_status_change();

-- 3. Update Quote Status RPC to include notifications
CREATE OR REPLACE FUNCTION public.update_quote_status_public(
    p_local_id TEXT,
    p_status TEXT,
    p_counter_amount NUMERIC DEFAULT NULL,
    p_client_message TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_quote_number TEXT;
BEGIN
    -- Perform the update and get the user_id back
    UPDATE public.quotes 
    SET 
        status = p_status,
        counter_amount = p_counter_amount,
        client_message = p_client_message,
        updated_at = now()
    WHERE local_id = p_local_id
    RETURNING user_id, quote_number INTO v_user_id, v_quote_number;

    -- Only generate notification if it's a client action from the public link
    IF v_user_id IS NOT NULL THEN
        IF p_status = 'ACCEPTED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (v_user_id, 'Quote Accepted', 'A client accepted Quote #' || COALESCE(v_quote_number, substr(p_local_id, 1, 8)), 'QUOTE_ACCEPTED', p_local_id);
            
        ELSIF p_status = 'DECLINED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (v_user_id, 'Quote Declined', 'A client declined Quote #' || COALESCE(v_quote_number, substr(p_local_id, 1, 8)), 'QUOTE_DECLINED', p_local_id);
            
        ELSIF p_status = 'COUNTERED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (v_user_id, 'Counter Offer Received', 'A client made a counter offer of ' || p_counter_amount || ' on Quote #' || COALESCE(v_quote_number, substr(p_local_id, 1, 8)), 'QUOTE_COUNTERED', p_local_id);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update Invoice Status RPC to include notifications
CREATE OR REPLACE FUNCTION public.update_invoice_status_public(
    p_local_id TEXT,
    p_status TEXT,
    p_amount_paid NUMERIC DEFAULT NULL,
    p_counter_amount NUMERIC DEFAULT NULL,
    p_client_message TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_invoice_number TEXT;
BEGIN
    -- Perform the update and get the user_id back
    UPDATE public.invoices 
    SET 
        status = p_status,
        amount_paid = p_amount_paid,
        counter_amount = p_counter_amount,
        client_message = p_client_message,
        updated_at = now()
    WHERE local_id = p_local_id
    RETURNING user_id, invoice_number INTO v_user_id, v_invoice_number;

    -- Only generate notification if it's a client action from the public link
    IF v_user_id IS NOT NULL THEN
        IF p_status = 'PAID' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (v_user_id, 'Invoice Paid', 'Invoice #' || COALESCE(v_invoice_number, substr(p_local_id, 1, 8)) || ' was paid in full.', 'INVOICE_PAID', p_local_id);
            
        ELSIF p_status = 'PARTIAL' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (v_user_id, 'Partial Payment', 'A partial payment was made on Invoice #' || COALESCE(v_invoice_number, substr(p_local_id, 1, 8)), 'INVOICE_PARTIAL', p_local_id);
            
        ELSIF p_status = 'COUNTERED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (v_user_id, 'Counter Offer Received', 'A client made a counter offer of ' || p_counter_amount || ' on Invoice #' || COALESCE(v_invoice_number, substr(p_local_id, 1, 8)), 'INVOICE_COUNTERED', p_local_id);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
