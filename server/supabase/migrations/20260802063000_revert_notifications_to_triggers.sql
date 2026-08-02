-- Migration V19: Revert to Trigger-Based Notifications
-- This removes notifications from the RPCs and restores them to triggers.
-- The triggers will check if auth.uid() IS DISTINCT FROM NEW.user_id to prevent self-notifications in-app.

-- 1. Revert Quote Status RPC (Remove notifications)
CREATE OR REPLACE FUNCTION public.update_quote_status_public(
    p_local_id TEXT,
    p_status TEXT,
    p_counter_amount NUMERIC DEFAULT NULL,
    p_client_message TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE public.quotes 
    SET 
        status = p_status,
        counter_amount = p_counter_amount,
        client_message = p_client_message,
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Revert Invoice Status RPC (Remove notifications)
CREATE OR REPLACE FUNCTION public.update_invoice_status_public(
    p_local_id TEXT,
    p_status TEXT,
    p_amount_paid NUMERIC DEFAULT NULL,
    p_counter_amount NUMERIC DEFAULT NULL,
    p_client_message TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE public.invoices 
    SET 
        status = p_status,
        amount_paid = p_amount_paid,
        counter_amount = p_counter_amount,
        client_message = p_client_message,
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Restore Quote Trigger Function
CREATE OR REPLACE FUNCTION public.handle_quote_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if the status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Avoid self-notifications: if the authenticated user is the owner, do not notify
        IF auth.uid() IS NOT DISTINCT FROM NEW.user_id THEN
            RETURN NEW;
        END IF;
        
        IF NEW.status = 'ACCEPTED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Quote Accepted', 'A client accepted quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_ACCEPTED', NEW.local_id);
            
        ELSIF NEW.status = 'DECLINED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Quote Declined', 'A client declined quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_DECLINED', NEW.local_id);
            
        ELSIF NEW.status = 'COUNTERED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Counter Offer Received', 'A client made a counter offer of ' || NEW.counter_amount || ' on quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_COUNTERED', NEW.local_id);
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Restore Invoice Trigger Function
CREATE OR REPLACE FUNCTION public.handle_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if the status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Avoid self-notifications: if the authenticated user is the owner, do not notify. But maybe always notify for PAID? No, user only wants notifications from public link.
        IF auth.uid() IS NOT DISTINCT FROM NEW.user_id THEN
            RETURN NEW;
        END IF;
        
        IF NEW.status = 'PAID' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Invoice Paid', 'Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)) || ' was paid in full.', 'INVOICE_PAID', NEW.local_id);
            
        ELSIF NEW.status = 'PARTIAL' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Partial Payment', 'A partial payment was made on Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)), 'INVOICE_PARTIAL', NEW.local_id);
            
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-create Triggers
DROP TRIGGER IF EXISTS on_quote_status_change ON public.quotes;
CREATE TRIGGER on_quote_status_change
    AFTER UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_quote_status_change();

DROP TRIGGER IF EXISTS on_invoice_status_change ON public.invoices;
CREATE TRIGGER on_invoice_status_change
    AFTER UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_invoice_status_change();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
