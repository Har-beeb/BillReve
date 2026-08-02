-- Migration V20: Fix Public Link Fetching and Notification Details
-- Adds RLS policies for unauthenticated viewing of clients and profiles by ID.
-- Updates notification triggers to include the client's name.

-- 1. Add read-only policies for public clients and profiles
DROP POLICY IF EXISTS "Anyone can view client by local_id" ON public.clients;
CREATE POLICY "Anyone can view client by local_id" ON public.clients
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view profile by id" ON public.profiles;
CREATE POLICY "Anyone can view profile by id" ON public.profiles
    FOR SELECT USING (true);

-- 2. Update Quote Trigger Function
CREATE OR REPLACE FUNCTION public.handle_quote_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_client_name TEXT;
BEGIN
    -- Only trigger if the status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Avoid self-notifications: if the authenticated user is the owner, do not notify
        IF auth.uid() IS NOT DISTINCT FROM NEW.user_id THEN
            RETURN NEW;
        END IF;

        -- Fetch the client's name
        SELECT name INTO v_client_name FROM public.clients WHERE local_id = NEW.client_id LIMIT 1;
        v_client_name := COALESCE(v_client_name, 'A client');
        
        IF NEW.status = 'ACCEPTED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Quote Accepted', v_client_name || ' accepted quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_ACCEPTED', NEW.local_id);
            
        ELSIF NEW.status = 'DECLINED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Quote Declined', v_client_name || ' declined quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_DECLINED', NEW.local_id);
            
        ELSIF NEW.status = 'COUNTERED' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Counter Offer Received', v_client_name || ' made a counter offer of ' || NEW.counter_amount || ' on quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_COUNTERED', NEW.local_id);
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Invoice Trigger Function
CREATE OR REPLACE FUNCTION public.handle_invoice_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_client_name TEXT;
BEGIN
    -- Only trigger if the status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Avoid self-notifications: if the authenticated user is the owner, do not notify
        IF auth.uid() IS NOT DISTINCT FROM NEW.user_id THEN
            RETURN NEW;
        END IF;

        -- Fetch the client's name
        SELECT name INTO v_client_name FROM public.clients WHERE local_id = NEW.client_id LIMIT 1;
        v_client_name := COALESCE(v_client_name, 'A client');
        
        IF NEW.status = 'PAID' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Invoice Paid', v_client_name || ' paid Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)) || ' in full.', 'INVOICE_PAID', NEW.local_id);
            
        ELSIF NEW.status = 'PARTIAL' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Partial Payment', v_client_name || ' made a partial payment on Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)), 'INVOICE_PARTIAL', NEW.local_id);
            
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
