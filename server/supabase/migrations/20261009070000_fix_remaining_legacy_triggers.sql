-- Fix all remaining legacy triggers that referenced user_id or profiles

-- 1. Fix handle_new_user to create an organization instead of a profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id uuid;
BEGIN
    -- Create the new organization
    INSERT INTO public.organizations (name, email)
    VALUES (
        COALESCE(new.raw_user_meta_data->>'full_name', 'My Business'), 
        new.email
    )
    RETURNING id INTO v_org_id;

    -- Add the user as the owner of the new organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, new.id, 'owner');

    RETURN new;
END;
$$;

-- 2. Fix check_user_quota to check organizations
CREATE OR REPLACE FUNCTION public.check_user_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_pro BOOLEAN;
    v_doc_count INT;
BEGIN
    -- Get organization profile
    SELECT is_pro INTO v_is_pro FROM public.organizations WHERE id = NEW.organization_id;
    
    IF NOT v_is_pro THEN
        IF TG_TABLE_NAME = 'invoices' THEN
            SELECT COUNT(*) INTO v_doc_count FROM public.invoices WHERE organization_id = NEW.organization_id AND deleted_at IS NULL;
        ELSIF TG_TABLE_NAME = 'quotes' THEN
            SELECT COUNT(*) INTO v_doc_count FROM public.quotes WHERE organization_id = NEW.organization_id AND deleted_at IS NULL;
        ELSE
            SELECT COUNT(*) INTO v_doc_count FROM public.clients WHERE organization_id = NEW.organization_id AND deleted_at IS NULL;
        END IF;

        IF v_doc_count >= 5 THEN
            RAISE EXCEPTION 'Free tier limit reached (5). Please upgrade to Pro.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Fix handle_invoice_status_change to use organization_id
CREATE OR REPLACE FUNCTION public.handle_invoice_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only trigger if the status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Avoid self-notifications: if the authenticated user is the one making the change, don't spam them.
        -- We check if they are in the org to skip? Actually, just check if they are auth.uid().
        IF auth.uid() IS NOT NULL THEN
            -- Since it's a tenant model, anyone making the change skips the notification for now.
            RETURN NEW;
        END IF;
        
        IF NEW.status = 'PAID' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (NEW.organization_id, 'Invoice Paid', 'Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)) || ' was paid in full.', 'INVOICE_PAID', NEW.local_id);
        ELSIF NEW.status = 'PARTIAL' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (NEW.organization_id, 'Partial Payment', 'A partial payment was made on Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)), 'INVOICE_PARTIAL', NEW.local_id);
        ELSIF NEW.status = 'PENDING' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (NEW.organization_id, 'Payment Transferred', 'A client reported transferring funds for Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)), 'INVOICE_PAID', NEW.local_id);
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Fix handle_quote_status_change to use organization_id
CREATE OR REPLACE FUNCTION public.handle_quote_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_name TEXT;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        IF auth.uid() IS NOT NULL THEN
            RETURN NEW;
        END IF;

        -- Fetch the client's name
        SELECT name INTO v_client_name FROM public.clients WHERE local_id = NEW.client_id AND organization_id = NEW.organization_id LIMIT 1;
        
        IF NEW.status = 'ACCEPTED' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (NEW.organization_id, 'Quote Accepted', COALESCE(v_client_name, 'A client') || ' accepted Quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_ACCEPTED', NEW.local_id);
        ELSIF NEW.status = 'DECLINED' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (NEW.organization_id, 'Quote Declined', COALESCE(v_client_name, 'A client') || ' declined Quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_DECLINED', NEW.local_id);
        ELSIF NEW.status = 'COUNTERED' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (NEW.organization_id, 'Counter Offer Received', COALESCE(v_client_name, 'A client') || ' made a counter offer of ' || NEW.counter_amount || ' on quote #' || COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8)), 'QUOTE_COUNTERED', NEW.local_id);
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$;
