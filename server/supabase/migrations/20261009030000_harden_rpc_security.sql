-- 20261009040000_harden_rpc_security.sql

-- 1. Harden protect_pro_status
CREATE OR REPLACE FUNCTION "public"."protect_pro_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Prevent users from modifying their own Pro status via the API
    IF (auth.role() = 'authenticated') THEN
        NEW.is_pro = OLD.is_pro;
        NEW.pro_expires_at = OLD.pro_expires_at;
    END IF;
    RETURN NEW;
END;
$$;

-- Since profiles is gone and replaced by organizations, update the trigger name and table!

DROP TRIGGER IF EXISTS "enforce_pro_status_protection" ON "public"."organizations";
CREATE TRIGGER "enforce_pro_status_protection" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."protect_pro_status"();

-- Also ensure INSERT trigger for organizations!
CREATE OR REPLACE FUNCTION "public"."protect_pro_status_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
    AS $$
BEGIN
    IF (auth.role() = 'authenticated') THEN
        NEW.is_pro = false;
        NEW.pro_expires_at = null;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "enforce_pro_status_protection_insert" BEFORE INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."protect_pro_status_insert"();

-- 2. Harden check_rate_limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_endpoint text, p_max_requests integer, p_window_minutes integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_requests integer;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    SELECT COUNT(*) INTO v_requests
    FROM public.api_logs
    WHERE endpoint = p_endpoint
    AND created_at > (now() - (p_window_minutes || ' minutes')::interval);
    
    IF v_requests >= p_max_requests THEN
        RETURN false;
    END IF;
    
    -- It's safe to insert a log without org_id here because api_logs triggers might need it...
    -- Wait, api_logs requires organization_id now!
    -- This function was broken by the previous migration! Let's fix it!
    INSERT INTO public.api_logs (endpoint, created_at, organization_id)
    SELECT p_endpoint, now(), organization_id FROM public.organization_members WHERE user_id = v_user_id LIMIT 1;
    
    RETURN true;
END;
$$;

-- 3. Harden clean_old_rate_limits
CREATE OR REPLACE FUNCTION public.clean_old_rate_limits()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.api_logs WHERE created_at < (now() - interval '24 hours');
END;
$$;
