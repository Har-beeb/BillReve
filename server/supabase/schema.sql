


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
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_seq INT;
BEGIN
    -- If it's a DRAFT or missing, assign an official number
    IF NEW.invoice_number IS NULL OR NEW.invoice_number LIKE 'DRAFT-%' THEN
        INSERT INTO public.user_sequences (organization_id, entity, next_value)
        VALUES (NEW.organization_id, 'invoice', 2)
        ON CONFLICT (organization_id, entity)
        DO UPDATE SET next_value = public.user_sequences.next_value + 1
        RETURNING next_value - 1 INTO v_seq;

        NEW.invoice_number := 'INV-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_quote_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_seq INT;
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number LIKE 'DRAFT-%' THEN
        INSERT INTO public.user_sequences (organization_id, entity, next_value)
        VALUES (NEW.organization_id, 'quote', 2)
        ON CONFLICT (organization_id, entity)
        DO UPDATE SET next_value = public.user_sequences.next_value + 1
        RETURNING next_value - 1 INTO v_seq;

        NEW.quote_number := 'QTE-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_quote_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_campaign_counter"("p_recipient_id" "uuid", "p_counter" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_campaign_id uuid;
BEGIN
    IF p_counter NOT IN ('bounced', 'complained', 'unsubscribed', 'failed') THEN
        RAISE EXCEPTION 'Unknown campaign counter: %', p_counter;
    END IF;

    SELECT campaign_id INTO v_campaign_id
      FROM public.campaign_recipients
     WHERE id = p_recipient_id;

    IF v_campaign_id IS NULL THEN
        RETURN;
    END IF;

    -- Explicit branches rather than dynamic SQL: the column name comes from a
    -- caller, and a fixed allow-list plus static statements removes any
    -- injection surface entirely.
    IF p_counter = 'bounced' THEN
        UPDATE public.campaigns SET bounced_count = bounced_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    ELSIF p_counter = 'complained' THEN
        UPDATE public.campaigns SET complained_count = complained_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    ELSIF p_counter = 'unsubscribed' THEN
        UPDATE public.campaigns SET unsubscribed_count = unsubscribed_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    ELSIF p_counter = 'failed' THEN
        UPDATE public.campaigns SET failed_count = failed_count + 1, updated_at = now()
         WHERE id = v_campaign_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."bump_campaign_counter"("p_recipient_id" "uuid", "p_counter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_log_rate_limit"("p_user_id" "uuid", "p_endpoint" "text", "p_limit" integer, "p_window_minutes" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_count  INT;
    v_org_id uuid;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = p_user_id
    LIMIT 1;

    -- Fail CLOSED. Previously the no-membership path fell through and granted
    -- the request without recording it.
    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.api_logs
    WHERE organization_id = v_org_id
      AND endpoint = p_endpoint
      AND created_at >= now() - (p_window_minutes || ' minutes')::INTERVAL;

    IF v_count < p_limit THEN
        INSERT INTO public.api_logs (organization_id, endpoint)
        VALUES (v_org_id, p_endpoint);
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_and_log_rate_limit"("p_user_id" "uuid", "p_endpoint" "text", "p_limit" integer, "p_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_campaign_quota"("p_recipient_count" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_org_id           uuid;
    v_is_pro           boolean;
    v_pro_expires      timestamptz;
    v_credits          integer;
    v_month_start      timestamptz := date_trunc('month', now());
    v_sent_this_month  integer;
    v_recent_campaigns integer;
    v_base_remaining   integer;
    v_total_available  integer;
    c_monthly_cap      CONSTANT integer := 250;
    c_weekly_campaigns CONSTANT integer := 2;
BEGIN
    SELECT organization_id INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'NO_ORGANIZATION',
            'message', 'We could not resolve your workspace. Please sign out and back in.');
    END IF;

    SELECT is_pro, pro_expires_at, COALESCE(campaign_credits_balance, 0)
      INTO v_is_pro, v_pro_expires, v_credits
      FROM public.organizations WHERE id = v_org_id;

    IF NOT (COALESCE(v_is_pro, false) AND (v_pro_expires IS NULL OR v_pro_expires > now())) THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'PRO_REQUIRED',
            'monthlyCap', c_monthly_cap,
            'message', 'Email campaigns are a Pro feature. Upgrade to send campaigns to your clients.');
    END IF;

    SELECT COUNT(*) INTO v_sent_this_month
      FROM public.campaign_recipients
     WHERE organization_id = v_org_id
       AND status = 'SENT'
       AND sent_at >= v_month_start;

    SELECT COUNT(*) INTO v_recent_campaigns
      FROM public.campaigns
     WHERE organization_id = v_org_id
       AND status IN ('QUEUED','SENDING','SENT','PARTIAL')
       AND created_at >= now() - interval '7 days';

    v_base_remaining  := GREATEST(c_monthly_cap - v_sent_this_month, 0);
    v_total_available := v_base_remaining + v_credits;

    -- Frequency limit applies regardless of how many credits are held. Buying a
    -- pack does not buy the right to mail the same list every other day; that
    -- pattern is what gets a sending domain throttled.
    IF v_recent_campaigns >= c_weekly_campaigns THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'FREQUENCY_LIMIT',
            'monthlyCap', c_monthly_cap,
            'sentThisMonth', v_sent_this_month,
            'baseRemaining', v_base_remaining,
            'credits', v_credits,
            'remaining', v_total_available,
            'campaignsThisWeek', v_recent_campaigns,
            'weeklyCampaignCap', c_weekly_campaigns,
            'message', format('You have already sent %s campaigns in the last 7 days. Sending more often than this harms your delivery rate, so the limit is %s per week.',
                              v_recent_campaigns, c_weekly_campaigns));
    END IF;

    IF GREATEST(p_recipient_count, 0) > v_total_available THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'MONTHLY_CAP',
            'monthlyCap', c_monthly_cap,
            'sentThisMonth', v_sent_this_month,
            'baseRemaining', v_base_remaining,
            'credits', v_credits,
            'remaining', v_total_available,
            'shortfall', GREATEST(p_recipient_count, 0) - v_total_available,
            'message', format('This campaign needs %s emails but you have %s available (%s left of your monthly %s, plus %s purchased credits).',
                              p_recipient_count, v_total_available, v_base_remaining, c_monthly_cap, v_credits));
    END IF;

    RETURN jsonb_build_object('allowed', true,
        'monthlyCap', c_monthly_cap,
        'sentThisMonth', v_sent_this_month,
        'baseRemaining', v_base_remaining,
        'credits', v_credits,
        'remaining', v_total_available,
        'campaignsThisWeek', v_recent_campaigns,
        'weeklyCampaignCap', c_weekly_campaigns);
END;
$$;


ALTER FUNCTION "public"."check_campaign_quota"("p_recipient_count" integer) OWNER TO "postgres";


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
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_attempts        INT;
  v_doc_attempts    INT;
  v_client_ip       TEXT;
  v_key             TEXT;
  -- Per-document ceiling. A real client clicks a handful of times; this only
  -- trips under automated abuse across many rotated source addresses.
  c_doc_ceiling     CONSTANT INT := 60;
  c_doc_window_mins CONSTANT INT := 60;
BEGIN
  -- Leftmost XFF entry is the originating client. Anything further right is a
  -- proxy hop. btrim because the header is comma-space separated.
  v_client_ip := NULLIF(btrim(split_part(
      COALESCE(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1)), '');
  v_client_ip := COALESCE(v_client_ip, inet_client_addr()::text, 'unknown');

  v_key := v_client_ip || ':' || p_identifier;

  IF random() < 0.01 THEN
    PERFORM public.clean_old_rate_limits();
  END IF;

  -- (a) tight per-source-per-document limit
  SELECT COUNT(*) INTO v_attempts
  FROM public.rate_limits
  WHERE identifier = v_key
    AND action = p_action
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  IF v_attempts >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  -- (b) generous per-document ceiling, independent of source address
  SELECT COUNT(*) INTO v_doc_attempts
  FROM public.rate_limits
  WHERE identifier LIKE '%:' || p_identifier
    AND action = p_action
    AND attempted_at > now() - (c_doc_window_mins || ' minutes')::interval;

  IF v_doc_attempts >= c_doc_ceiling THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limits (identifier, action) VALUES (v_key, p_action);
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_identifier" "text", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_is_pro       boolean;
    v_pro_expires  timestamptz;
    v_count        INT;
    v_limit        INT;
    v_month_start  timestamptz := date_trunc('month', now());
BEGIN
    IF NEW.organization_id IS NULL THEN
        RAISE EXCEPTION 'Cannot create records without an organization';
    END IF;

    SELECT is_pro, pro_expires_at
      INTO v_is_pro, v_pro_expires
      FROM public.organizations
     WHERE id = NEW.organization_id;

    -- Fail CLOSED on a missing organization rather than falling through.
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    -- An expired Pro subscription is not Pro.
    IF COALESCE(v_is_pro, false)
       AND (v_pro_expires IS NULL OR v_pro_expires > now()) THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'clients' THEN
        -- Clients are a standing total, not a monthly flow.
        SELECT COUNT(*) INTO v_count
          FROM public.clients
         WHERE organization_id = NEW.organization_id
           AND deleted_at IS NULL;
        v_limit := 5;

        IF v_count >= v_limit THEN
            RAISE EXCEPTION 'Free tier limit reached (% clients). Upgrade to Pro for unlimited clients.', v_limit;
        END IF;

    ELSIF TG_TABLE_NAME = 'invoices' THEN
        SELECT COUNT(*) INTO v_count
          FROM public.invoices
         WHERE organization_id = NEW.organization_id
           AND deleted_at IS NULL
           AND created_at >= v_month_start;
        v_limit := 10;

        IF v_count >= v_limit THEN
            RAISE EXCEPTION 'Free tier limit reached (% invoices this month). Upgrade to Pro for unlimited invoices.', v_limit;
        END IF;

    ELSIF TG_TABLE_NAME = 'quotes' THEN
        SELECT COUNT(*) INTO v_count
          FROM public.quotes
         WHERE organization_id = NEW.organization_id
           AND deleted_at IS NULL
           AND created_at >= v_month_start;
        v_limit := 10;

        IF v_count >= v_limit THEN
            RAISE EXCEPTION 'Free tier limit reached (% quotes this month). Upgrade to Pro for unlimited quotes.', v_limit;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_user_quota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_old_rate_limits"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE attempted_at < now() - interval '1 hour';
END;
$$;


ALTER FUNCTION "public"."clean_old_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."empty_trash_based_on_plan"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Pro organizations keep deleted items for 30 days, free ones for 7.
    DELETE FROM public.invoices i
    USING public.organizations o
    WHERE i.organization_id = o.id
      AND i.deleted_at IS NOT NULL
      AND i.deleted_at < now() - (CASE WHEN COALESCE(o.is_pro, false) THEN interval '30 days'
                                                                      ELSE interval '7 days' END);

    DELETE FROM public.quotes q
    USING public.organizations o
    WHERE q.organization_id = o.id
      AND q.deleted_at IS NOT NULL
      AND q.deleted_at < now() - (CASE WHEN COALESCE(o.is_pro, false) THEN interval '30 days'
                                                                      ELSE interval '7 days' END);

    DELETE FROM public.clients c
    USING public.organizations o
    WHERE c.organization_id = o.id
      AND c.deleted_at IS NOT NULL
      AND c.deleted_at < now() - (CASE WHEN COALESCE(o.is_pro, false) THEN interval '30 days'
                                                                      ELSE interval '7 days' END);
END;
$$;


ALTER FUNCTION "public"."empty_trash_based_on_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_minor"("p_amount" bigint, "p_currency" "text" DEFAULT 'NGN'::"text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT COALESCE(NULLIF(btrim(p_currency), ''), 'NGN')
           || ' '
           || to_char(COALESCE(p_amount, 0)::numeric / 100, 'FM999,999,999,990.00');
$$;


ALTER FUNCTION "public"."format_minor"("p_amount" bigint, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_context"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_org_id   uuid;
    v_currency text;
BEGIN
    SELECT organization_id INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object(
            'totalRevenue',    0,
            'outstanding',     0,
            'overdueCount',    0,
            'clientCount',     0,
            'clients',         '[]'::jsonb,
            'recentInvoices',  '[]'::jsonb,
            'recentQuotes',    '[]'::jsonb
        );
    END IF;

    SELECT currency INTO v_currency FROM public.organizations WHERE id = v_org_id;

    RETURN jsonb_build_object(
        'currency', COALESCE(v_currency, 'NGN'),

        -- Headline metrics
        'totalRevenue', COALESCE((
            SELECT SUM(total) FROM public.invoices
             WHERE organization_id = v_org_id AND deleted_at IS NULL AND status = 'PAID'
        ), 0),
        'outstanding', COALESCE((
            SELECT SUM(total - COALESCE(amount_paid, 0)) FROM public.invoices
             WHERE organization_id = v_org_id AND deleted_at IS NULL
               AND status IN ('SENT','PENDING','PARTIAL','OVERDUE')
        ), 0),
        'overdueCount', COALESCE((
            SELECT COUNT(*) FROM public.invoices
             WHERE organization_id = v_org_id AND deleted_at IS NULL AND status = 'OVERDUE'
        ), 0),
        'clientCount', COALESCE((
            SELECT COUNT(*) FROM public.clients
             WHERE organization_id = v_org_id AND deleted_at IS NULL
        ), 0),

        -- The client DIRECTORY. `id` is the local_id, which is exactly what a
        -- CREATE_INVOICE / CREATE_QUOTE action must put in payload.clientId.
        'clients', COALESCE((
            SELECT jsonb_agg(row_to_json(c))
              FROM (
                SELECT cl.local_id AS id,
                       cl.name,
                       (SELECT COUNT(*) FROM public.invoices i
                         WHERE i.organization_id = v_org_id
                           AND i.client_id = cl.local_id
                           AND i.deleted_at IS NULL) AS "invoiceCount",
                       COALESCE((SELECT SUM(i.amount_paid) FROM public.invoices i
                                  WHERE i.organization_id = v_org_id
                                    AND i.client_id = cl.local_id
                                    AND i.deleted_at IS NULL), 0) AS "totalPaid",
                       COALESCE((SELECT SUM(i.total - COALESCE(i.amount_paid, 0)) FROM public.invoices i
                                  WHERE i.organization_id = v_org_id
                                    AND i.client_id = cl.local_id
                                    AND i.deleted_at IS NULL
                                    AND i.status IN ('SENT','PENDING','PARTIAL','OVERDUE')), 0) AS "outstanding"
                  FROM public.clients cl
                 WHERE cl.organization_id = v_org_id
                   AND cl.deleted_at IS NULL
                 ORDER BY cl.name
                 LIMIT 200
              ) c
        ), '[]'::jsonb),

        -- Recent invoices, now WITH ids so actions can target them.
        'recentInvoices', COALESCE((
            SELECT jsonb_agg(row_to_json(i))
              FROM (
                SELECT inv.local_id AS id,
                       inv.invoice_number,
                       inv.description,
                       inv.status,
                       inv.total,
                       inv.amount_paid,
                       inv.currency,
                       inv.due_date,
                       inv.created_at,
                       inv.client_id,
                       c.name AS client_name
                  FROM public.invoices inv
                  LEFT JOIN public.clients c
                         ON c.local_id = inv.client_id
                        AND c.organization_id = v_org_id
                 WHERE inv.organization_id = v_org_id
                   AND inv.deleted_at IS NULL
                 ORDER BY inv.created_at DESC
                 LIMIT 25
              ) i
        ), '[]'::jsonb),

        -- Quotes were absent entirely, so "/quote" could never work.
        'recentQuotes', COALESCE((
            SELECT jsonb_agg(row_to_json(q))
              FROM (
                SELECT qt.local_id AS id,
                       qt.quote_number,
                       qt.description,
                       qt.status,
                       qt.total,
                       qt.counter_amount,
                       qt.currency,
                       qt.expires_at,
                       qt.created_at,
                       qt.client_id,
                       c.name AS client_name
                  FROM public.quotes qt
                  LEFT JOIN public.clients c
                         ON c.local_id = qt.client_id
                        AND c.organization_id = v_org_id
                 WHERE qt.organization_id = v_org_id
                   AND qt.deleted_at IS NULL
                 ORDER BY qt.created_at DESC
                 LIMIT 25
              ) q
        ), '[]'::jsonb)
    );
END;
$$;


ALTER FUNCTION "public"."get_ai_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_merchant_secret"("p_org_id" "uuid", "p_gateway" "text") RETURNS "text"
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
        WHERE organization_id = p_org_id;
    ELSIF p_gateway = 'flutterwave' THEN
        SELECT CASE WHEN flutterwave_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_key_encrypted, v_encryption_key) END
        INTO v_secret
        FROM public.user_secrets
        WHERE organization_id = p_org_id;
    ELSE
        RAISE EXCEPTION 'Unknown gateway';
    END IF;

    RETURN v_secret;
END;
$$;


ALTER FUNCTION "public"."get_merchant_secret"("p_org_id" "uuid", "p_gateway" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_status" "text" DEFAULT 'synced'::"text",
    "deleted_at" timestamp with time zone,
    "is_purged" boolean DEFAULT false,
    "organization_id" "uuid" NOT NULL
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
    "local_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "subtotal" bigint NOT NULL,
    "total" bigint NOT NULL,
    "amount_paid" bigint DEFAULT 0 NOT NULL,
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
    "counter_amount" bigint,
    "client_message" "text",
    "allow_counter_offer" boolean DEFAULT false,
    "notes" "text",
    "deleted_at" timestamp with time zone,
    "is_purged" boolean DEFAULT false,
    "last_reminded_at" timestamp with time zone,
    "theme" "text" DEFAULT 'standard'::"text",
    "bank_account_snapshot" "jsonb",
    "organization_id" "uuid" NOT NULL
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


CREATE OR REPLACE FUNCTION "public"."get_public_profile"("p_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "address" "text", "logo_url" "text", "country" "text", "currency" "text", "bank_accounts" "jsonb", "paystack_public_key" "text", "flutterwave_public_key" "text", "is_pro" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT o.id,
           o.name,
           o.address,
           o.logo_url,
           o.country,
           o.currency,
           o.bank_accounts,
           o.paystack_public_key,
           o.flutterwave_public_key,
           COALESCE(o.is_pro, false)
      FROM public.organizations o
     WHERE o.id = p_id
     LIMIT 1;
$$;


ALTER FUNCTION "public"."get_public_profile"("p_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "subtotal" bigint NOT NULL,
    "total" bigint NOT NULL,
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
    "counter_amount" bigint,
    "client_message" "text",
    "allow_counter_offer" boolean DEFAULT false,
    "notes" "text",
    "deleted_at" timestamp with time zone,
    "is_purged" boolean DEFAULT false,
    "minimum_counter_amount" bigint,
    "theme" "text" DEFAULT 'standard'::"text",
    "bank_account_snapshot" "jsonb",
    "organization_id" "uuid" NOT NULL
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
    v_org_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
    LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN;
    END IF;

    v_encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'billreve_fallback_secret_99');

    RETURN QUERY 
    SELECT 
        CASE WHEN paystack_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(paystack_key_encrypted, v_encryption_key) END,
        CASE WHEN flutterwave_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_key_encrypted, v_encryption_key) END
    FROM public.user_secrets
    WHERE organization_id = v_org_id;
END;
$$;


ALTER FUNCTION "public"."get_user_secrets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_campaign_credits"("p_org_id" "uuid", "p_emails" integer, "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint DEFAULT NULL::bigint, "p_currency" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_inserted boolean;
    v_balance  integer;
BEGIN
    IF p_emails IS NULL OR p_emails <= 0 THEN
        RAISE EXCEPTION 'Credit grant must be positive, got %', p_emails;
    END IF;
    IF p_reference IS NULL OR btrim(p_reference) = '' THEN
        RAISE EXCEPTION 'A gateway reference is required for idempotency';
    END IF;

    INSERT INTO public.campaign_credit_purchases
        (organization_id, emails, amount_minor, currency, gateway, reference)
    VALUES
        (p_org_id, p_emails, p_amount_minor, p_currency, p_gateway, btrim(p_reference))
    ON CONFLICT (gateway, reference) DO NOTHING;

    v_inserted := FOUND;

    IF NOT v_inserted THEN
        SELECT campaign_credits_balance INTO v_balance
          FROM public.organizations WHERE id = p_org_id;
        RETURN jsonb_build_object('granted', false, 'reason', 'DUPLICATE',
                                  'balance', COALESCE(v_balance, 0));
    END IF;

    UPDATE public.organizations
       SET campaign_credits_balance = campaign_credits_balance + p_emails,
           updated_at = now()
     WHERE id = p_org_id
    RETURNING campaign_credits_balance INTO v_balance;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Organization % not found', p_org_id;
    END IF;

    RETURN jsonb_build_object('granted', true, 'emails', p_emails, 'balance', v_balance);
END;
$$;


ALTER FUNCTION "public"."grant_campaign_credits"("p_org_id" "uuid", "p_emails" integer, "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_invoice_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_ref text;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN

        -- See the header note: only anonymous (public-link) actions notify,
        -- because the feed has no per-recipient addressing yet.
        IF auth.uid() IS NOT NULL THEN
            RETURN NEW;
        END IF;

        v_ref := COALESCE(NEW.invoice_number, substr(NEW.local_id, 1, 8));

        IF NEW.status = 'PAID' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (
                NEW.organization_id,
                'Invoice Paid',
                'Invoice #' || v_ref || ' was paid in full ('
                    || public.format_minor(NEW.total, NEW.currency) || ').',
                'INVOICE_PAID',
                NEW.local_id
            );

        ELSIF NEW.status = 'PARTIAL' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (
                NEW.organization_id,
                'Partial Payment',
                'A partial payment of ' || public.format_minor(NEW.amount_paid, NEW.currency)
                    || ' was made on Invoice #' || v_ref
                    || ' (total ' || public.format_minor(NEW.total, NEW.currency) || ').',
                'INVOICE_PARTIAL',
                NEW.local_id
            );

        ELSIF NEW.status = 'PENDING' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (
                NEW.organization_id,
                'Payment Transferred',
                'A client reported transferring funds for Invoice #' || v_ref
                    || ' (' || public.format_minor(NEW.total, NEW.currency) || ').',
                'INVOICE_PAID',
                NEW.local_id
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_invoice_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_quote_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_client_name text;
    v_ref         text;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN

        IF auth.uid() IS NOT NULL THEN
            RETURN NEW;
        END IF;

        SELECT name INTO v_client_name
          FROM public.clients
         WHERE local_id = NEW.client_id
           AND organization_id = NEW.organization_id
         LIMIT 1;

        v_ref := COALESCE(NEW.quote_number, substr(NEW.local_id, 1, 8));

        IF NEW.status = 'ACCEPTED' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (
                NEW.organization_id,
                'Quote Accepted',
                COALESCE(v_client_name, 'A client') || ' accepted Quote #' || v_ref
                    || ' (' || public.format_minor(NEW.total, NEW.currency) || ').',
                'QUOTE_ACCEPTED',
                NEW.local_id
            );

        ELSIF NEW.status = 'DECLINED' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (
                NEW.organization_id,
                'Quote Declined',
                COALESCE(v_client_name, 'A client') || ' declined Quote #' || v_ref || '.',
                'QUOTE_DECLINED',
                NEW.local_id
            );

        ELSIF NEW.status = 'COUNTERED' THEN
            INSERT INTO public.notifications (organization_id, title, message, type, entity_id)
            VALUES (
                NEW.organization_id,
                'Counter Offer Received',
                COALESCE(v_client_name, 'A client') || ' made a counter offer of '
                    || public.format_minor(NEW.counter_amount, NEW.currency)
                    || ' on Quote #' || v_ref
                    || ' (originally ' || public.format_minor(NEW.total, NEW.currency) || ').',
                'QUOTE_COUNTERED',
                NEW.local_id
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_quote_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of"("_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = _org_id AND user_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."is_member_of"("_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_owner"("_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = _org_id
          AND user_id = auth.uid()
          AND role = 'owner'
    );
$$;


ALTER FUNCTION "public"."is_org_owner"("_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_pro_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."protect_pro_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_pro_status_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF (auth.role() = 'authenticated') THEN
        NEW.is_pro = false;
        NEW.pro_expires_at = null;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_pro_status_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_campaign"("p_subject" "text", "p_title" "text", "p_preview_text" "text", "p_content_html" "text", "p_content_json" "jsonb", "p_client_ids" "text"[], "p_proofread" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_org_id       uuid;
    v_quota        jsonb;
    v_campaign_id  uuid;
    v_eligible     integer;
    v_suppressed   integer;
    v_no_email     integer;
    v_blocking     integer := 0;
    v_base_left    integer;
    v_credits_used integer := 0;
BEGIN
    SELECT organization_id INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_ORGANIZATION',
            'message', 'We could not resolve your workspace.');
    END IF;

    IF p_subject IS NULL OR btrim(p_subject) = '' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_SUBJECT',
            'message', 'A campaign needs a subject line.');
    END IF;

    IF p_content_html IS NULL OR btrim(p_content_html) = '' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_CONTENT',
            'message', 'A campaign needs some content.');
    END IF;

    IF p_proofread IS NOT NULL THEN
        SELECT COALESCE(jsonb_array_length(p_proofread -> 'blocking'), 0) INTO v_blocking;
        IF v_blocking > 0 THEN
            RETURN jsonb_build_object('success', false, 'reason', 'PROOFREAD_BLOCKED',
                'message', 'This campaign has issues that would likely get it blocked or marked as spam. Resolve them and try again.',
                'report', p_proofread);
        END IF;
    END IF;

    WITH chosen AS (
        SELECT c.local_id, lower(btrim(c.email)) AS email
          FROM public.clients c
         WHERE c.organization_id = v_org_id
           AND c.deleted_at IS NULL
           AND c.local_id = ANY (p_client_ids)
    )
    SELECT
        COUNT(*) FILTER (
            WHERE email IS NOT NULL AND email <> ''
              AND NOT EXISTS (
                  SELECT 1 FROM public.email_suppressions s
                   WHERE s.organization_id = v_org_id AND s.email = chosen.email)
        ),
        COUNT(*) FILTER (
            WHERE email IS NOT NULL AND email <> ''
              AND EXISTS (
                  SELECT 1 FROM public.email_suppressions s
                   WHERE s.organization_id = v_org_id AND s.email = chosen.email)
        ),
        COUNT(*) FILTER (WHERE email IS NULL OR email = '')
      INTO v_eligible, v_suppressed, v_no_email
      FROM chosen;

    IF COALESCE(v_eligible, 0) = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'NO_RECIPIENTS',
            'suppressed', COALESCE(v_suppressed, 0),
            'missingEmail', COALESCE(v_no_email, 0),
            'message', 'None of the selected clients can be emailed — they either have no email address or have unsubscribed.');
    END IF;

    v_quota := public.check_campaign_quota(v_eligible);
    IF NOT (v_quota ->> 'allowed')::boolean THEN
        RETURN jsonb_build_object('success', false,
            'reason', v_quota ->> 'reason',
            'message', v_quota ->> 'message',
            'quota', v_quota);
    END IF;

    -- Spend the monthly base first, then purchased credits.
    v_base_left := COALESCE((v_quota ->> 'baseRemaining')::integer, 0);
    IF v_eligible > v_base_left THEN
        v_credits_used := v_eligible - v_base_left;

        UPDATE public.organizations
           SET campaign_credits_balance = campaign_credits_balance - v_credits_used,
               updated_at = now()
         WHERE id = v_org_id
           AND campaign_credits_balance >= v_credits_used;

        IF NOT FOUND THEN
            -- Lost a race against a concurrent campaign. The CHECK constraint
            -- would have caught it anyway; this gives a readable error.
            RETURN jsonb_build_object('success', false, 'reason', 'INSUFFICIENT_CREDITS',
                'message', 'Your campaign credits were used by another send. Please refresh and try again.');
        END IF;
    END IF;

    INSERT INTO public.campaigns (
        organization_id, subject, title, preview_text, content_html, content_json,
        status, recipient_count, proofread_report, queued_at
    )
    VALUES (
        v_org_id, btrim(p_subject), p_title, p_preview_text, p_content_html, p_content_json,
        'QUEUED', v_eligible, p_proofread, now()
    )
    RETURNING id INTO v_campaign_id;

    INSERT INTO public.campaign_recipients (campaign_id, organization_id, client_id, email)
    SELECT v_campaign_id, v_org_id, c.local_id, lower(btrim(c.email))
      FROM public.clients c
     WHERE c.organization_id = v_org_id
       AND c.deleted_at IS NULL
       AND c.local_id = ANY (p_client_ids)
       AND c.email IS NOT NULL
       AND btrim(c.email) <> ''
       AND NOT EXISTS (
           SELECT 1 FROM public.email_suppressions s
            WHERE s.organization_id = v_org_id
              AND s.email = lower(btrim(c.email)))
    ON CONFLICT (campaign_id, email) DO NOTHING;

    RETURN jsonb_build_object('success', true,
        'campaignId', v_campaign_id,
        'queued', v_eligible,
        'suppressed', COALESCE(v_suppressed, 0),
        'missingEmail', COALESCE(v_no_email, 0),
        'creditsUsed', v_credits_used,
        'quota', public.check_campaign_quota(0),
        'message', format('Campaign queued for %s recipients.', v_eligible));
END;
$$;


ALTER FUNCTION "public"."queue_campaign"("p_subject" "text", "p_title" "text", "p_preview_text" "text", "p_content_html" "text", "p_content_json" "jsonb", "p_client_ids" "text"[], "p_proofread" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_email_suppression"("p_org_id" "uuid", "p_email" "text", "p_reason" "text", "p_detail" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF p_reason NOT IN ('UNSUBSCRIBED','BOUNCED','COMPLAINED','MANUAL') THEN
        RAISE EXCEPTION 'Invalid suppression reason: %', p_reason;
    END IF;

    INSERT INTO public.email_suppressions (organization_id, email, reason, detail)
    VALUES (p_org_id, lower(btrim(p_email)), p_reason, p_detail)
    ON CONFLICT (organization_id, email) DO UPDATE
       SET reason = EXCLUDED.reason,
           detail = EXCLUDED.detail;
END;
$$;


ALTER FUNCTION "public"."record_email_suppression"("p_org_id" "uuid", "p_email" "text", "p_reason" "text", "p_detail" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_payment_event"("p_org_id" "uuid", "p_invoice_local_id" "text", "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint, "p_currency" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."record_payment_event"("p_org_id" "uuid", "p_invoice_local_id" "text", "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_secrets"("p_paystack" "text", "p_flutterwave" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_encryption_key TEXT;
    v_uid UUID;
    v_org_id UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT organization_id INTO v_org_id 
    FROM public.organization_members 
    WHERE user_id = v_uid 
    LIMIT 1;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;

    v_encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'billreve_fallback_secret_99');

    INSERT INTO public.user_secrets (organization_id, paystack_key_encrypted, flutterwave_key_encrypted, updated_at)
    VALUES (
        v_org_id,
        CASE WHEN p_paystack IS NULL THEN NULL ELSE extensions.pgp_sym_encrypt(p_paystack, v_encryption_key) END,
        CASE WHEN p_flutterwave IS NULL THEN NULL ELSE extensions.pgp_sym_encrypt(p_flutterwave, v_encryption_key) END,
        now()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
        paystack_key_encrypted = EXCLUDED.paystack_key_encrypted,
        flutterwave_key_encrypted = EXCLUDED.flutterwave_key_encrypted,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."set_user_secrets"("p_paystack" "text", "p_flutterwave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unsubscribe_by_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_rec record;
BEGIN
    IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
        RETURN jsonb_build_object('success', false, 'message', 'That unsubscribe link is not valid.');
    END IF;

    SELECT cr.id, cr.organization_id, cr.email, cr.campaign_id
      INTO v_rec
      FROM public.campaign_recipients cr
     WHERE cr.unsubscribe_token = p_token
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'That unsubscribe link is not valid or has expired.');
    END IF;

    INSERT INTO public.email_suppressions (organization_id, email, reason, detail)
    VALUES (v_rec.organization_id, lower(v_rec.email), 'UNSUBSCRIBED',
            'Unsubscribed via campaign link')
    ON CONFLICT (organization_id, email) DO NOTHING;

    UPDATE public.campaigns
       SET unsubscribed_count = unsubscribed_count + 1,
           updated_at = now()
     WHERE id = v_rec.campaign_id;

    RETURN jsonb_build_object('success', true,
        'message', 'You have been unsubscribed and will not receive further marketing emails from this business.');
END;
$$;


ALTER FUNCTION "public"."unsubscribe_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint DEFAULT NULL::bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_target_invoice record;
BEGIN
    -- A public, unauthenticated caller may only move an invoice into a state
    -- that asserts intent, never one that asserts settlement. PAID and PARTIAL
    -- are both excluded: they are the webhook's to set, after it has verified
    -- the amount against the invoice total.
    IF p_status NOT IN ('PENDING', 'DECLINED', 'COUNTERED', 'DRAFT', 'SENT') THEN
        RAISE EXCEPTION 'Invalid public invoice status transition: %', p_status;
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

    -- Never move a settled invoice backwards from a public link.
    IF v_target_invoice.status = 'PAID' THEN
        RAISE EXCEPTION 'This invoice is already settled';
    END IF;

    UPDATE public.invoices
    SET
        status      = COALESCE(p_status, status),
        -- IDEMPOTENT: set, never increment. Replaying this call is a no-op.
        amount_paid = COALESCE(p_amount_paid, amount_paid),
        updated_at  = now()
    WHERE local_id = p_local_id;
END;
$$;


ALTER FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" bigint DEFAULT NULL::bigint, "p_client_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF "p_status" NOT IN ('VIEWED', 'ACCEPTED', 'DECLINED', 'COUNTERED') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE quotes
  SET 
    status = "p_status",
    counter_amount = COALESCE("p_counter_amount", counter_amount),
    client_message = COALESCE("p_client_message", client_message),
    updated_at = NOW()
  WHERE local_id = "p_local_id";
END;
$$;


ALTER FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" bigint, "p_client_message" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."api_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_credit_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "emails" integer NOT NULL,
    "amount_minor" bigint,
    "currency" "text",
    "gateway" "text" NOT NULL,
    "reference" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaign_credit_purchases_emails_check" CHECK (("emails" > 0))
);


ALTER TABLE "public"."campaign_credit_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "client_id" "text",
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "unsubscribe_token" "text" DEFAULT ("replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") || "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text")) NOT NULL,
    "provider_message_id" "text",
    "error" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaign_recipients_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'SENT'::"text", 'FAILED'::"text", 'BOUNCED'::"text", 'COMPLAINED'::"text", 'SUPPRESSED'::"text"])))
);


ALTER TABLE "public"."campaign_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "title" "text",
    "preview_text" "text",
    "content_html" "text" NOT NULL,
    "content_json" "jsonb",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "sent_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "bounced_count" integer DEFAULT 0 NOT NULL,
    "complained_count" integer DEFAULT 0 NOT NULL,
    "unsubscribed_count" integer DEFAULT 0 NOT NULL,
    "proofread_report" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "queued_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaigns_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'QUEUED'::"text", 'SENDING'::"text", 'SENT'::"text", 'PARTIAL'::"text", 'FAILED'::"text", 'BLOCKED'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_suppressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_suppressions_reason_check" CHECK (("reason" = ANY (ARRAY['UNSUBSCRIBED'::"text", 'BOUNCED'::"text", 'COMPLAINED'::"text", 'MANUAL'::"text"])))
);


ALTER TABLE "public"."email_suppressions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "entity_id" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "logo_url" "text",
    "paystack_public_key" "text",
    "flutterwave_public_key" "text",
    "country" "text",
    "currency" "text",
    "industry" "text",
    "business_description" "text",
    "bank_accounts" "jsonb" DEFAULT '[]'::"jsonb",
    "email_flags" "jsonb" DEFAULT '{}'::"jsonb",
    "is_pro" boolean DEFAULT false,
    "pro_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "campaign_credits_balance" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "chk_logo_url_no_base64" CHECK ((("logo_url" IS NULL) OR ("logo_url" !~~ 'data:image%'::"text"))),
    CONSTRAINT "organizations_campaign_credits_non_negative" CHECK (("campaign_credits_balance" >= 0))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invoice_local_id" "text" NOT NULL,
    "gateway" "text" NOT NULL,
    "reference" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" "text" NOT NULL,
    "action" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "client_id" "text" NOT NULL,
    "template_invoice_id" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "next_run_date" "date" NOT NULL,
    "end_date" "date",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "local_id" "text" NOT NULL,
    "sync_status" "text" DEFAULT 'synced'::"text",
    "deleted_at" timestamp with time zone,
    "is_purged" boolean DEFAULT false,
    CONSTRAINT "recurring_schedules_frequency_check" CHECK (("frequency" = ANY (ARRAY['WEEKLY'::"text", 'MONTHLY'::"text", 'YEARLY'::"text"]))),
    CONSTRAINT "recurring_schedules_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'PAUSED'::"text", 'COMPLETED'::"text"])))
);


ALTER TABLE "public"."recurring_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_secrets" (
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "paystack_key_encrypted" "bytea",
    "flutterwave_key_encrypted" "bytea",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sequences" (
    "entity" "text" NOT NULL,
    "next_value" integer DEFAULT 1,
    "organization_id" "uuid" NOT NULL
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



ALTER TABLE ONLY "public"."campaign_credit_purchases"
    ADD CONSTRAINT "campaign_credit_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_credit_purchases"
    ADD CONSTRAINT "campaign_credit_purchases_reference_key" UNIQUE ("gateway", "reference");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_token_key" UNIQUE ("unsubscribe_token");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_unique_email" UNIQUE ("campaign_id", "email");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_org_id_local_id_key" UNIQUE ("organization_id", "local_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_suppressions"
    ADD CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_suppressions"
    ADD CONSTRAINT "email_suppressions_unique" UNIQUE ("organization_id", "email");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_org_id_local_id_key" UNIQUE ("organization_id", "local_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_gateway_reference_key" UNIQUE ("gateway", "reference");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_org_id_local_id_key" UNIQUE ("organization_id", "local_id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_schedules"
    ADD CONSTRAINT "recurring_schedules_org_id_local_id_key" UNIQUE ("organization_id", "local_id");



ALTER TABLE ONLY "public"."recurring_schedules"
    ADD CONSTRAINT "recurring_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."user_sequences"
    ADD CONSTRAINT "user_sequences_pkey" PRIMARY KEY ("organization_id", "entity");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_api_logs_org_endpoint_created" ON "public"."api_logs" USING "btree" ("organization_id", "endpoint", "created_at" DESC);



CREATE INDEX "idx_api_logs_rate_limit" ON "public"."api_logs" USING "btree" ("organization_id", "endpoint", "created_at");



CREATE INDEX "idx_campaign_credit_purchases_org" ON "public"."campaign_credit_purchases" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_campaign_recipients_org_sent" ON "public"."campaign_recipients" USING "btree" ("organization_id", "sent_at" DESC) WHERE ("status" = 'SENT'::"text");



CREATE INDEX "idx_campaign_recipients_pending" ON "public"."campaign_recipients" USING "btree" ("campaign_id", "status") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "idx_campaigns_org_created" ON "public"."campaigns" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_clients_deleted_at" ON "public"."clients" USING "btree" ("deleted_at");



CREATE INDEX "idx_email_suppressions_lookup" ON "public"."email_suppressions" USING "btree" ("organization_id", "email");



CREATE INDEX "idx_invoices_deleted_at" ON "public"."invoices" USING "btree" ("deleted_at");



CREATE INDEX "idx_invoices_org_created" ON "public"."invoices" USING "btree" ("organization_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_payment_events_invoice" ON "public"."payment_events" USING "btree" ("organization_id", "invoice_local_id", "created_at" DESC);



CREATE INDEX "idx_quotes_deleted_at" ON "public"."quotes" USING "btree" ("deleted_at");



CREATE INDEX "idx_quotes_org_created" ON "public"."quotes" USING "btree" ("organization_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_rate_limits_lookup" ON "public"."rate_limits" USING "btree" ("identifier", "action", "attempted_at" DESC);



CREATE INDEX "idx_recurring_schedules_org_id" ON "public"."recurring_schedules" USING "btree" ("organization_id");



CREATE INDEX "idx_recurring_schedules_run_date" ON "public"."recurring_schedules" USING "btree" ("next_run_date", "status");



CREATE OR REPLACE TRIGGER "before_insert_invoice_number" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."assign_invoice_number"();



CREATE OR REPLACE TRIGGER "before_insert_quote_number" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."assign_quote_number"();



CREATE OR REPLACE TRIGGER "enforce_client_quota" BEFORE INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."check_user_quota"();



CREATE OR REPLACE TRIGGER "enforce_invoice_quota" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."check_user_quota"();



CREATE OR REPLACE TRIGGER "enforce_pro_status_protection" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."protect_pro_status"();



CREATE OR REPLACE TRIGGER "enforce_pro_status_protection_insert" BEFORE INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."protect_pro_status_insert"();



CREATE OR REPLACE TRIGGER "enforce_quote_quota" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."check_user_quota"();



CREATE OR REPLACE TRIGGER "on_invoice_status_change" AFTER UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_invoice_status_change"();



CREATE OR REPLACE TRIGGER "on_quote_status_change" AFTER UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_quote_status_change"();



CREATE OR REPLACE TRIGGER "update_recurring_schedules_modtime" BEFORE UPDATE ON "public"."recurring_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



ALTER TABLE ONLY "public"."api_logs"
    ADD CONSTRAINT "api_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_credit_purchases"
    ADD CONSTRAINT "campaign_credit_purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_suppressions"
    ADD CONSTRAINT "email_suppressions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_schedules"
    ADD CONSTRAINT "recurring_schedules_client_local_id_fkey" FOREIGN KEY ("organization_id", "client_id") REFERENCES "public"."clients"("organization_id", "local_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_schedules"
    ADD CONSTRAINT "recurring_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_schedules"
    ADD CONSTRAINT "recurring_schedules_template_local_id_fkey" FOREIGN KEY ("organization_id", "template_invoice_id") REFERENCES "public"."invoices"("organization_id", "local_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sequences"
    ADD CONSTRAINT "user_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Members can delete clients" ON "public"."clients" FOR DELETE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can delete invoices" ON "public"."invoices" FOR DELETE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can delete notifications" ON "public"."notifications" FOR DELETE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can delete quotes" ON "public"."quotes" FOR DELETE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can insert clients" ON "public"."clients" FOR INSERT WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can insert invoices" ON "public"."invoices" FOR INSERT WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can insert quotes" ON "public"."quotes" FOR INSERT WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can insert secrets" ON "public"."user_secrets" FOR INSERT WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can update clients" ON "public"."clients" FOR UPDATE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can update invoices" ON "public"."invoices" FOR UPDATE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can update notifications" ON "public"."notifications" FOR UPDATE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can update quotes" ON "public"."quotes" FOR UPDATE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can update secrets" ON "public"."user_secrets" FOR UPDATE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can view clients" ON "public"."clients" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can view invoices" ON "public"."invoices" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can view notifications" ON "public"."notifications" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can view payment events" ON "public"."payment_events" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can view quotes" ON "public"."quotes" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can view secrets" ON "public"."user_secrets" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members can view sequences" ON "public"."user_sequences" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members delete campaigns" ON "public"."campaigns" FOR DELETE USING (("public"."is_member_of"("organization_id") AND ("status" = ANY (ARRAY['DRAFT'::"text", 'BLOCKED'::"text", 'FAILED'::"text"]))));



CREATE POLICY "Members delete suppressions" ON "public"."email_suppressions" FOR DELETE USING (("public"."is_member_of"("organization_id") AND ("reason" = 'MANUAL'::"text")));



CREATE POLICY "Members insert campaigns" ON "public"."campaigns" FOR INSERT WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members insert suppressions" ON "public"."email_suppressions" FOR INSERT WITH CHECK (("public"."is_member_of"("organization_id") AND ("reason" = 'MANUAL'::"text")));



CREATE POLICY "Members update campaigns" ON "public"."campaigns" FOR UPDATE USING (("public"."is_member_of"("organization_id") AND ("status" = 'DRAFT'::"text")));



CREATE POLICY "Members view campaign recipients" ON "public"."campaign_recipients" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members view campaigns" ON "public"."campaigns" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members view credit purchases" ON "public"."campaign_credit_purchases" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Members view suppressions" ON "public"."email_suppressions" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Owners can add members" ON "public"."organization_members" FOR INSERT WITH CHECK ("public"."is_org_owner"("organization_id"));



CREATE POLICY "Owners can delete secrets" ON "public"."user_secrets" FOR DELETE USING ("public"."is_org_owner"("organization_id"));



CREATE POLICY "Owners can remove members" ON "public"."organization_members" FOR DELETE USING ("public"."is_org_owner"("organization_id"));



CREATE POLICY "Owners can update members" ON "public"."organization_members" FOR UPDATE USING ("public"."is_org_owner"("organization_id"));



CREATE POLICY "Users can create recurring schedules in their organization" ON "public"."recurring_schedules" FOR INSERT WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Users can delete recurring schedules in their organization" ON "public"."recurring_schedules" FOR DELETE USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Users can update recurring schedules in their organization" ON "public"."recurring_schedules" FOR UPDATE USING ("public"."is_member_of"("organization_id")) WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Users can update their organizations" ON "public"."organizations" FOR UPDATE USING ("public"."is_member_of"("id"));



CREATE POLICY "Users can view members of their organizations" ON "public"."organization_members" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Users can view recurring schedules in their organization" ON "public"."recurring_schedules" FOR SELECT USING ("public"."is_member_of"("organization_id"));



CREATE POLICY "Users can view their organizations" ON "public"."organizations" FOR SELECT USING ("public"."is_member_of"("id"));



ALTER TABLE "public"."api_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_credit_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_suppressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clients";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."invoices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quotes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."recurring_schedules";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


















































































































































































































REVOKE ALL ON FUNCTION "public"."bump_campaign_counter"("p_recipient_id" "uuid", "p_counter" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bump_campaign_counter"("p_recipient_id" "uuid", "p_counter" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_campaign_quota"("p_recipient_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_campaign_quota"("p_recipient_count" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."get_ai_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ai_context"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_merchant_secret"("p_org_id" "uuid", "p_gateway" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_merchant_secret"("p_org_id" "uuid", "p_gateway" "text") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."get_public_profile"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_profile"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile"("p_id" "uuid") TO "authenticated";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_quote"("p_local_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_quote"("p_local_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."grant_campaign_credits"("p_org_id" "uuid", "p_emails" integer, "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint, "p_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_campaign_credits"("p_org_id" "uuid", "p_emails" integer, "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint, "p_currency" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_member_of"("_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_member_of"("_org_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_org_owner"("_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_org_owner"("_org_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."queue_campaign"("p_subject" "text", "p_title" "text", "p_preview_text" "text", "p_content_html" "text", "p_content_json" "jsonb", "p_client_ids" "text"[], "p_proofread" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."queue_campaign"("p_subject" "text", "p_title" "text", "p_preview_text" "text", "p_content_html" "text", "p_content_json" "jsonb", "p_client_ids" "text"[], "p_proofread" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."record_email_suppression"("p_org_id" "uuid", "p_email" "text", "p_reason" "text", "p_detail" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_email_suppression"("p_org_id" "uuid", "p_email" "text", "p_reason" "text", "p_detail" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_payment_event"("p_org_id" "uuid", "p_invoice_local_id" "text", "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint, "p_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_payment_event"("p_org_id" "uuid", "p_invoice_local_id" "text", "p_gateway" "text", "p_reference" "text", "p_amount_minor" bigint, "p_currency" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."unsubscribe_by_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unsubscribe_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unsubscribe_by_token"("p_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint) TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" bigint, "p_client_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" bigint, "p_client_message" "text") TO "authenticated";






























GRANT ALL ON TABLE "public"."api_logs" TO "anon";
GRANT ALL ON TABLE "public"."api_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."api_logs" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_credit_purchases" TO "anon";
GRANT ALL ON TABLE "public"."campaign_credit_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_credit_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_recipients" TO "anon";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."email_suppressions" TO "anon";
GRANT ALL ON TABLE "public"."email_suppressions" TO "authenticated";
GRANT ALL ON TABLE "public"."email_suppressions" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_schedules" TO "anon";
GRANT ALL ON TABLE "public"."recurring_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_schedules" TO "service_role";



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




























