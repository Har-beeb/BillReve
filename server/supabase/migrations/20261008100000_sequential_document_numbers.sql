CREATE TABLE IF NOT EXISTS public.user_sequences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    entity TEXT,
    next_value INT DEFAULT 1,
    PRIMARY KEY (user_id, entity)
);

ALTER TABLE public.user_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sequences" ON public.user_sequences FOR SELECT USING (auth.uid() = user_id);

-- Trigger function for invoices
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safely drop before recreating
DROP TRIGGER IF EXISTS before_insert_invoice_number ON public.invoices;
CREATE TRIGGER before_insert_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

-- Trigger function for quotes
CREATE OR REPLACE FUNCTION public.assign_quote_number()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safely drop before recreating
DROP TRIGGER IF EXISTS before_insert_quote_number ON public.quotes;
CREATE TRIGGER before_insert_quote_number
BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.assign_quote_number();
