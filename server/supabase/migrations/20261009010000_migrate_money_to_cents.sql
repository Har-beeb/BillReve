-- Migrate Invoices
ALTER TABLE invoices
ALTER COLUMN subtotal TYPE BIGINT USING ROUND(subtotal * 100)::BIGINT,
ALTER COLUMN total TYPE BIGINT USING ROUND(total * 100)::BIGINT,
ALTER COLUMN amount_paid TYPE BIGINT USING ROUND(amount_paid * 100)::BIGINT,
ALTER COLUMN counter_amount TYPE BIGINT USING ROUND(counter_amount * 100)::BIGINT;

-- Migrate JSONB taxes array inside invoices
UPDATE invoices
SET taxes = (
  SELECT jsonb_agg(
    jsonb_set(
      tax, 
      '{amount}', 
      (ROUND((tax->>'amount')::numeric * 100)::bigint)::text::jsonb
    )
  )
  FROM jsonb_array_elements(taxes) AS tax
)
WHERE jsonb_typeof(taxes) = 'array' AND jsonb_array_length(taxes) > 0;

-- Migrate JSONB items array inside invoices
UPDATE invoices
SET items = (
  SELECT jsonb_agg(
    jsonb_set(
      jsonb_set(
        item,
        '{unitPrice}',
        (ROUND((item->>'unitPrice')::numeric * 100)::bigint)::text::jsonb
      ),
      '{amount}',
      (ROUND((item->>'amount')::numeric * 100)::bigint)::text::jsonb
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0;


-- Migrate Quotes
ALTER TABLE quotes
ALTER COLUMN subtotal TYPE BIGINT USING ROUND(subtotal * 100)::BIGINT,
ALTER COLUMN total TYPE BIGINT USING ROUND(total * 100)::BIGINT,
ALTER COLUMN counter_amount TYPE BIGINT USING ROUND(counter_amount * 100)::BIGINT,
ALTER COLUMN minimum_counter_amount TYPE BIGINT USING ROUND(minimum_counter_amount * 100)::BIGINT;

-- Migrate JSONB taxes array inside quotes
UPDATE quotes
SET taxes = (
  SELECT jsonb_agg(
    jsonb_set(
      tax, 
      '{amount}', 
      (ROUND((tax->>'amount')::numeric * 100)::bigint)::text::jsonb
    )
  )
  FROM jsonb_array_elements(taxes) AS tax
)
WHERE jsonb_typeof(taxes) = 'array' AND jsonb_array_length(taxes) > 0;

-- Migrate JSONB items array inside quotes
UPDATE quotes
SET items = (
  SELECT jsonb_agg(
    jsonb_set(
      jsonb_set(
        item,
        '{unitPrice}',
        (ROUND((item->>'unitPrice')::numeric * 100)::bigint)::text::jsonb
      ),
      '{amount}',
      (ROUND((item->>'amount')::numeric * 100)::bigint)::text::jsonb
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0;

-- Update RPC functions to accept BIGINT instead of numeric
DROP FUNCTION IF EXISTS "public"."update_invoice_status_public"(text, text, numeric, numeric, text);
DROP FUNCTION IF EXISTS "public"."update_invoice_status_public"(text, text, numeric);
DROP FUNCTION IF EXISTS "public"."update_quote_status_public"(text, text, numeric, text);

CREATE OR REPLACE FUNCTION "public"."update_invoice_status_public"(
  "p_local_id" "text", 
  "p_status" "text", 
  "p_amount_paid" bigint DEFAULT NULL::bigint, 
  "p_counter_amount" bigint DEFAULT NULL::bigint, 
  "p_client_message" "text" DEFAULT NULL::"text"
) RETURNS "void"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rate limiting and validation logic remains the same
  IF "p_status" NOT IN ('VIEWED', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'PAID', 'VOID') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF "p_status" = 'PAID' THEN
    RAISE EXCEPTION 'Cannot mark as PAID from public endpoints';
  END IF;

  UPDATE invoices
  SET 
    status = "p_status",
    counter_amount = COALESCE("p_counter_amount", counter_amount),
    client_message = COALESCE("p_client_message", client_message),
    updated_at = NOW()
  WHERE local_id = "p_local_id";
END;
$$;
ALTER FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint, "p_counter_amount" bigint, "p_client_message" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_quote_status_public"(
  "p_local_id" "text", 
  "p_status" "text", 
  "p_counter_amount" bigint DEFAULT NULL::bigint, 
  "p_client_message" "text" DEFAULT NULL::"text"
) RETURNS "void"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint, "p_counter_amount" bigint, "p_client_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_status_public"("p_local_id" "text", "p_status" "text", "p_amount_paid" bigint, "p_counter_amount" bigint, "p_client_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" bigint, "p_client_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_quote_status_public"("p_local_id" "text", "p_status" "text", "p_counter_amount" bigint, "p_client_message" "text") TO "authenticated";
