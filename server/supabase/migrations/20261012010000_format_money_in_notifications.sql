-- =============================================================================
-- 20261012010000_format_money_in_notifications.sql
--
-- Notifications interpolated raw BIGINT minor units into human-readable text,
-- so a 5,000.00 counter-offer read as "500000" — the trailing kobo digits with
-- no decimal point, which is genuinely ambiguous (is that 500,000 or 5,000?).
--
--   20261009070000_fix_remaining_legacy_triggers.sql:122
--     ' made a counter offer of ' || NEW.counter_amount || ' on quote #'
--
-- Adds a `format_minor()` helper and uses it everywhere money appears in
-- notification text. Also enriches the invoice notifications with amounts,
-- which is the information the merchant actually wants in the feed.
--
-- NOTE on self-notification suppression: both triggers return early when
-- `auth.uid() IS NOT NULL`, so notifications only fire for anonymous
-- public-link actions. That is deliberately left as-is here. `notifications`
-- is scoped to `organization_id` with no recipient `user_id`, so notifying on
-- a teammate's action would also notify the person who performed it. Giving
-- teammates useful notifications requires a recipient column first; that is
-- tracked in working.md rather than bodged here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- format_minor: BIGINT minor units -> human-readable currency string.
--
-- to_char with the FM prefix strips the leading padding, so 500000 renders as
-- "NGN 5,000.00" rather than "NGN      5,000.00".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.format_minor(
    p_amount bigint,
    p_currency text DEFAULT 'NGN'
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(NULLIF(btrim(p_currency), ''), 'NGN')
           || ' '
           || to_char(COALESCE(p_amount, 0)::numeric / 100, 'FM999,999,999,990.00');
$$;

ALTER FUNCTION public.format_minor(bigint, text) OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- Invoice status notifications — now include the amounts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

ALTER FUNCTION public.handle_invoice_status_change() OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- Quote status notifications — this is where the raw 500000 appeared.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_quote_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

ALTER FUNCTION public.handle_quote_status_change() OWNER TO postgres;

NOTIFY pgrst, 'reload schema';
