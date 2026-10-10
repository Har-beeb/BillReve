-- Fix trigger functions to use organization_id for sequences

CREATE OR REPLACE FUNCTION public.assign_invoice_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

CREATE OR REPLACE FUNCTION public.assign_quote_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
