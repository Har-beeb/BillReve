


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."InvoiceStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PENDING',
    'PARTIAL',
    'PAID',
    'OVERDUE'
);


ALTER TYPE "public"."InvoiceStatus" OWNER TO "postgres";


CREATE TYPE "public"."QuoteStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'DECLINED'
);


ALTER TYPE "public"."QuoteStatus" OWNER TO "postgres";


CREATE TYPE "public"."SubscriptionPlan" AS ENUM (
    'FREE',
    'PRO',
    'ENTERPRISE'
);


ALTER TYPE "public"."SubscriptionPlan" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_invoice_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_seq INT;
BEGIN
    -- If it's a DRAFT or missing, assign an official number
    IF NEW.invoice_number IS NULL OR NEW.invoice_number LIKE 'DRAFT-%' THEN
        INSERT INTO public.user_sequences (user_id, entity, next_value)
        VALUES (NEW.user_id, 'invoice', 2)
        ON CONFLICT (user_id, entity)
        DO UPDATE SET next_value = user_sequences.next_value + 1
        RETURNING next_value - 1 INTO v_seq;

        NEW.invoice_number := 'INV-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_quote_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_seq INT;
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number LIKE 'DRAFT-%' THEN
        INSERT INTO public.user_sequences (user_id, entity, next_value)
        VALUES (NEW.user_id, 'quote', 2)
        ON CONFLICT (user_id, entity)
        DO UPDATE SET next_value = user_sequences.next_value + 1
        RETURNING next_value - 1 INTO v_seq;

        NEW.quote_number := 'QTE-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_quote_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_log_rate_limit"("p_user_id" "uuid", "p_endpoint" "text", "p_limit" integer, "p_window_minutes" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.api_logs
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint
      AND created_at >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;
      
    IF v_count < p_limit THEN
        INSERT INTO public.api_logs (user_id, endpoint) VALUES (p_user_id, p_endpoint);
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_and_log_rate_limit"("p_user_id" "uuid", "p_endpoint" "text", "p_limit" integer, "p_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Need to bypass RLS to check auth.users directly
  -- Security Definer ensures it runs as postgres superuser
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;


ALTER FUNCTION "public"."check_email_exists"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_identifier" "text", "p_action" "text", "p_max_attempts" integer DEFAULT 5, "p_window_minutes" integer DEFAULT 10) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  attempt_count INT;
  v_client_ip TEXT;
  v_rate_limit_key TEXT;
BEGIN
  -- Get client IP via Supabase PostgREST header fallback to inet_client_addr
  v_client_ip := COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', inet_client_addr()::text, 'unknown');
  
  -- Combine IP and identifier for the true rate limit key to prevent targeted DoS
  v_rate_limit_key := v_client_ip || ':' || p_identifier;

  -- Clean old entries opportunistically (1% chance per call)
  IF random() < 0.01 THEN
    PERFORM public.clean_old_rate_limits();
  END IF;

  -- Count recent attempts for this IP + Document combination
  SELECT COUNT(*) INTO attempt_count
  FROM public.rate_limits
  WHERE identifier = v_rate_limit_key
    AND action = p_action
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  -- If over limit, reject
  IF attempt_count >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  -- Log this attempt
  INSERT INTO public.rate_limits (identifier, action)
  VALUES (v_rate_limit_key, p_action);

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_identifier" "text", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_doc_count INT;
BEGIN
  -- Get user profile
  SELECT is_pro INTO v_is_pro FROM public.profiles WHERE id = NEW.user_id;
  
  IF NOT v_is_pro THEN
    IF TG_TABLE_NAME = 'invoices' THEN
      -- Count active invoices
      SELECT COUNT(*) INTO v_doc_count FROM public.invoices WHERE user_id = NEW.user_id AND deleted_at IS NULL;
    ELSIF TG_TABLE_NAME = 'quotes' THEN
      -- Count active quotes
      SELECT COUNT(*) INTO v_doc_count FROM public.quotes WHERE user_id = NEW.user_id AND deleted_at IS NULL;
    END IF;
    
    IF v_doc_count >= 10 THEN
      RAISE EXCEPTION 'Free tier limit reached. You can only have up to 10 active %.', TG_TABLE_NAME;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_user_quota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_old_rate_limits"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE attempted_at < now() - interval '1 hour';
END;
$$;


ALTER FUNCTION "public"."clean_old_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."empty_trash_based_on_plan"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete old invoices
  DELETE FROM public.invoices i
  USING public.profiles p
  WHERE i.user_id = p.id 
  AND i.deleted_at IS NOT NULL 
  AND (
    (p.is_pro = false AND i.deleted_at < NOW() - INTERVAL '7 days') OR
    (p.is_pro = true AND i.deleted_at < NOW() - INTERVAL '30 days')
  );

  -- Delete old quotes
  DELETE FROM public.quotes q
  USING public.profiles p
  WHERE q.user_id = p.id 
  AND q.deleted_at IS NOT NULL 
  AND (
    (p.is_pro = false AND q.deleted_at < NOW() - INTERVAL '7 days') OR
    (p.is_pro = true AND q.deleted_at < NOW() - INTERVAL '30 days')
  );

  -- Delete old clients
  DELETE FROM public.clients c
  USING public.profiles p
  WHERE c.user_id = p.id 
  AND c.deleted_at IS NOT NULL 
  AND (
    (p.is_pro = false AND c.deleted_at < NOW() - INTERVAL '7 days') OR
    (p.is_pro = true AND c.deleted_at < NOW() - INTERVAL '30 days')
  );
END;
$$;


ALTER FUNCTION "public"."empty_trash_based_on_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_context"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT jsonb_build_object(
    'totalRevenue', COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0),
    'outstanding', COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('SENT','PENDING','PARTIAL','OVERDUE')), 0),
    'overdueCount', COUNT(*) FILTER (WHERE status = 'OVERDUE'),
    'clientCount', (SELECT COUNT(*) FROM clients WHERE user_id = auth.uid() AND deleted_at IS NULL),
    'recentInvoices', (
      SELECT jsonb_agg(row_to_json(i))
      FROM (
        SELECT
          inv.invoice_number,
          inv.description,
          inv.status,
          inv.total,
          inv.amount_paid,
          inv.due_date,
          inv.created_at,
          c.name AS client_name
        FROM invoices inv
        LEFT JOIN clients c ON c.local_id = inv.client_id AND c.user_id = auth.uid()
        WHERE inv.user_id = auth.uid()
        ORDER BY inv.created_at DESC
        LIMIT 25
      ) i
    )
  )
  FROM invoices WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_ai_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_merchant_secret"("p_user_id" "uuid", "p_gateway" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_encryption_key TEXT;
    v_secret TEXT;
BEGIN
    v_encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'billreve_fallback_secret_99');

    IF p_gateway = 'paystack' THEN
        SELECT CASE WHEN paystack_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(paystack_key_encrypted, v_encryption_key) END
        INTO v_secret
        FROM public.user_secrets
        WHERE user_id = p_user_id;
    ELSIF p_gateway = 'flutterwave' THEN
        SELECT CASE WHEN flutterwave_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_key_encrypted, v_encryption_key) END
        INTO v_secret
        FROM public.user_secrets
        WHERE user_id = p_user_id;
    ELSE
        RAISE EXCEPTION 'Unknown gateway';
    END IF;

    RETURN v_secret;
END;
$$;


ALTER FUNCTION "public"."get_merchant_secret"("p_user_id" "uuid", "p_gateway" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "local_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_status" "text" DEFAULT 'synced'::"text",
    "deleted_at" timestamp with time zone,
    "is_purged" boolean DEFAULT false
);

ALTER TABLE ONLY "public"."clients" REPLICA IDENTITY FULL;


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_client"("p_local_id" "text") RETURNS SETOF "public"."clients"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.clients WHERE local_id = p_local_id LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_public_client"("p_local_id" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "local_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "subtotal" numeric NOT NULL,
    "total" numeric NOT NULL,
    "amount_paid" numeric DEFAULT 0 NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "taxes" "jsonb" DEFAULT '[]'::"jsonb",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "quote_id" "text",
    "issued_at" timestamp with time zone,
    "due_date" timestamp with time zone,
    "next_issue_on" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_status" "text" DEFAULT 'synced'::"text",
    "invoice_number" "text",
    "description" "text",
    "bank_account_id" "text",
    "counter_amount" numeric(15,2),
    "client_message" "text",
    "allow_counter_offer" boolean DEFAULT false,
    "notes" "text",
    "deleted_at" timestamp with time zone,
    "is_purged" boolean DEFAULT false,
    "last_reminded_at" timestamp with time zone,
    "theme" "text" DEFAULT 'standard'::"text",
    "bank_account_snapshot" "jsonb"
);

ALTER TABLE ONLY "public"."invoices" REPLICA IDENTITY FULL;


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_invoice"("p_local_id" "text") RETURNS SETOF "public"."invoices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.invoices WHERE local_id = p_local_id LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_public_invoice"("p_local_id" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "paystack_public_key" "text",
    "email_flags" "jsonb" DEFAULT '{}'::"jsonb",
    "is_pro" boolean DEFAULT false,
    "flutterwave_public_key" "text",
    "country" "text",
    "currency" "text",
    "pro_expires_at" timestamp with time zone,
    "industry" "text",
    "business_description" "text",
    "bank_accounts" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "chk_logo_url_no_base64" CHECK ((("logo_url" IS NULL) OR ("logo_url" !~~ 'data:image%'::"text")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_profile"("p_id" "uuid") RETURNS SETOF "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.profiles WHERE id = p_id LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_public_profile"("p_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "local_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "subtotal" numeric NOT NULL,
    "total" numeric NOT NULL,
    "taxes" "jsonb" DEFAULT '[]'::"jsonb",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "invoice_id" "text",
    "issued_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_status" "text" DEFAULT 'synced'::"text",
    "quote_number" "text",
    "description" "text",
    "bank_account_id" "text",
    "counter_amount" numeric(15,2),
    "client_message" "text",
    "allow_counter_offer" boolean DEFAULT false,
    "notes" "text",
    "deleted_at" timestamp with time zone,
    "is_purged" boolean DEFAULT false,
    "minimum_counter_amount" numeric,
    "theme" "text" DEFAULT 'standard'::"text",
    "bank_account_snapshot" "jsonb"
);

ALTER TABLE ONLY "public"."quotes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_quote"("p_local_id" "text") RETURNS SETOF "public"."quotes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.quotes WHERE local_id = p_local_id LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_public_quote"("p_local_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_secrets"() RETURNS TABLE("paystack_secret_key" "text", "flutterwave_secret_key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_encryption_key TEXT;
BEGIN
    v_encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'billreve_fallback_secret_99');

    RETURN QUERY 
    SELECT 
        CASE WHEN paystack_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(paystack_key_encrypted, v_encryption_key) END,
        CASE WHEN flutterwave_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_key_encrypted, v_encryption_key) END
    FROM public.user_secrets
    WHERE user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_user_secrets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_invoice_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only trigger if the status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Avoid self-notifications: if the authenticated user is the owner, do not notify.
        IF auth.uid() IS NOT DISTINCT FROM NEW.user_id THEN
            RETURN NEW;
        END IF;
        
        IF NEW.status = 'PAID' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Invoice Paid', 'Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)) || ' was paid in full.', 'INVOICE_PAID', NEW.local_id);
            
        ELSIF NEW.status = 'PARTIAL' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Partial Payment', 'A partial payment was made on Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)), 'INVOICE_PARTIAL', NEW.local_id);
            
        ELSIF NEW.status = 'PENDING' THEN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id)
            VALUES (NEW.user_id, 'Payment Transferred', 'A client reported transferring funds for Invoice #' || COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8)), 'INVOICE_PAID', NEW.local_id);
            
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_invoice_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_quote_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_quote_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_pro_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only restrict changes if the user is calling this via the client API (authenticated role)
  -- Service role (used by our webhooks) can still update these fields.
  IF auth.role() = 'authenticated' THEN
    NEW.is_pro = OLD.is_pro;
    NEW.pro_expires_at = OLD.pro_expires_at;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_pro_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_secrets"("p_paystack" "text", "p_flutterwave" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_encryption_key TEXT;
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'billreve_fallback_secret_99');

    INSERT INTO public.user_secrets (user_id, paystack_key_encrypted, flutterwave_key_encrypted, updated_at)
    VALUES (
        v_uid,
        CASE WHEN p_paystack IS NULL THEN NULL ELSE extensions.pgp_sym_encrypt(p_paystack, v_encryption_key) END,
        CASE WHEN p_flutterwave IS NULL THEN NULL ELSE extensions.pgp_sym_encrypt(p_flutterwave, v_encryption_key) END,
        now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        paystack_key_encrypted = EXCLUDED.paystack_key_encrypted,
        flutterwave_key_encrypted = EXCLUDED.flutterwave_key_encrypted,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."set_user_secrets"("p_paystack" "text", "p_flutterwave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric DEFAULT NULL::numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$;


ALTER FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric DEFAULT NULL::numeric, "p_counter_amount" numeric DEFAULT NULL::numeric, "p_client_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_target_invoice record;
BEGIN
    -- Validate Status Allow-list for PUBLIC access
    -- A public user cannot set an invoice to PAID directly. That must come from the webhook or the merchant.
    IF p_status NOT IN ('PENDING', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT') THEN
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
        -- Make amount_paid idempotent! Do not allow double counting via additive logic.
        amount_paid = COALESCE(p_amount_paid, amount_paid),
        counter_amount = COALESCE(p_counter_amount, counter_amount),
        client_message = COALESCE(p_client_message, client_message),
        updated_at = now()
    WHERE local_id = p_local_id;
END;
$$;


ALTER FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric, "p_counter_amount" numeric, "p_client_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" numeric DEFAULT NULL::numeric, "p_client_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_target_quote record;
BEGIN
    -- Validate Status Allow-list
    IF p_status NOT IN ('ACCEPTED', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT') THEN
        RAISE EXCEPTION 'Invalid quote status transition';
    END IF;

    IF NOT public.check_rate_limit(p_local_id, 'quote_status', 5, 10) THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
    END IF;

    SELECT * INTO v_target_quote 
    FROM public.quotes 
    WHERE local_id = p_local_id;

    IF v_target_quote IS NULL THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    -- Enforce minimum counter amount based on the database record, not client trust
    IF p_status = 'COUNTERED' AND p_counter_amount IS NOT NULL THEN
        IF v_target_quote.allow_counter_offer = false THEN
            RAISE EXCEPTION 'Counter offers are not allowed for this quote';
        END IF;
        IF p_counter_amount < v_target_quote.minimum_counter_amount THEN
            RAISE EXCEPTION 'Counter offer is below the minimum allowed amount';
        END IF;
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


ALTER FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" numeric, "p_client_message" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "endpoint" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "entity_id" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" "text" NOT NULL,
    "action" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_secrets" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "paystack_key_encrypted" "bytea",
    "flutterwave_key_encrypted" "bytea"
);


ALTER TABLE "public"."user_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sequences" (
    "user_id" "uuid" NOT NULL,
    "entity" "text" NOT NULL,
    "next_value" integer DEFAULT 1
);


ALTER TABLE "public"."user_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_type" "text",
    "payload" "jsonb",
    "status" "text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."api_logs"
    ADD CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_local_id_key" UNIQUE ("user_id", "local_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_local_id_key" UNIQUE ("user_id", "local_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_user_id_local_id_key" UNIQUE ("user_id", "local_id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_sequences"
    ADD CONSTRAINT "user_sequences_pkey" PRIMARY KEY ("user_id", "entity");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_api_logs_rate_limit" ON "public"."api_logs" USING "btree" ("user_id", "endpoint", "created_at");



CREATE INDEX "idx_clients_deleted_at" ON "public"."clients" USING "btree" ("deleted_at");



CREATE INDEX "idx_invoices_deleted_at" ON "public"."invoices" USING "btree" ("deleted_at");



CREATE INDEX "idx_quotes_deleted_at" ON "public"."quotes" USING "btree" ("deleted_at");



CREATE INDEX "idx_rate_limits_lookup" ON "public"."rate_limits" USING "btree" ("identifier", "action", "attempted_at" DESC);



CREATE OR REPLACE TRIGGER "before_insert_invoice_number" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."assign_invoice_number"();



CREATE OR REPLACE TRIGGER "before_insert_quote_number" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."assign_quote_number"();



CREATE OR REPLACE TRIGGER "enforce_invoice_quota" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."check_user_quota"();



CREATE OR REPLACE TRIGGER "enforce_pro_status_protection" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_pro_status"();



CREATE OR REPLACE TRIGGER "enforce_quote_quota" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."check_user_quota"();



CREATE OR REPLACE TRIGGER "on_invoice_status_change" AFTER UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_invoice_status_change"();



CREATE OR REPLACE TRIGGER "on_quote_status_change" AFTER UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_quote_status_change"();



ALTER TABLE ONLY "public"."api_logs"
    ADD CONSTRAINT "api_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sequences"
    ADD CONSTRAINT "user_sequences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view client by local_id" ON "public"."clients" FOR SELECT USING (true);



CREATE POLICY "Block old clients app versions" ON "public"."clients" AS RESTRICTIVE FOR SELECT USING ((((("current_setting"('request.headers'::"text", true))::json ->> 'x-app-version'::"text") = '1.3.1'::"text") OR (CURRENT_USER = 'postgres'::"name")));



CREATE POLICY "Block old invoices app versions" ON "public"."invoices" AS RESTRICTIVE FOR SELECT USING ((((("current_setting"('request.headers'::"text", true))::json ->> 'x-app-version'::"text") = '1.3.1'::"text") OR (CURRENT_USER = 'postgres'::"name")));



CREATE POLICY "Block old quotes app versions" ON "public"."quotes" AS RESTRICTIVE FOR SELECT USING ((((("current_setting"('request.headers'::"text", true))::json ->> 'x-app-version'::"text") = '1.3.1'::"text") OR (CURRENT_USER = 'postgres'::"name")));



CREATE POLICY "Users can delete own clients" ON "public"."clients" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own invoices" ON "public"."invoices" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own quotes" ON "public"."quotes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own clients" ON "public"."clients" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own invoices" ON "public"."invoices" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own quotes" ON "public"."quotes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own secrets" ON "public"."user_secrets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own secrets" ON "public"."user_secrets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own secrets" ON "public"."user_secrets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own clients" ON "public"."clients" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own invoices" ON "public"."invoices" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own quotes" ON "public"."quotes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own secrets" ON "public"."user_secrets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own secrets" ON "public"."user_secrets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own clients" ON "public"."clients" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own quotes" ON "public"."quotes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own secrets" ON "public"."user_secrets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own sequences" ON "public"."user_sequences" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."api_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clients";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."invoices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quotes";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


















































































































































































































GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."get_ai_context"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_merchant_secret"("p_user_id" "uuid", "p_gateway" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_merchant_secret"("p_user_id" "uuid", "p_gateway" "text") TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_client"("p_local_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_client"("p_local_id" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_invoice"("p_local_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_invoice"("p_local_id" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_profile"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile"("p_id" "uuid") TO "authenticated";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_quote"("p_local_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_quote"("p_local_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric) TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric, "p_counter_amount" numeric, "p_client_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" numeric, "p_counter_amount" numeric, "p_client_message" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" numeric, "p_client_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" numeric, "p_client_message" "text") TO "authenticated";






























GRANT ALL ON TABLE "public"."api_logs" TO "anon";
GRANT ALL ON TABLE "public"."api_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."api_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."user_secrets" TO "anon";
GRANT ALL ON TABLE "public"."user_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."user_sequences" TO "anon";
GRANT ALL ON TABLE "public"."user_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























