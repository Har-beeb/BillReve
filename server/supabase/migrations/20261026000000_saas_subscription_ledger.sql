-- Keep SaaS subscription payments and provider identifiers separate from the
-- organization entitlement flags. The unique provider reference makes webhook
-- retries harmless, while the subscription record lets renewal events resolve
-- an organization without trusting repeatable client metadata.

CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
    organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('paystack')),
    customer_code text,
    subscription_code text,
    plan_code text,
    status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'DISABLED')),
    current_period_end timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS saas_subscriptions_provider_customer_idx
    ON public.saas_subscriptions(provider, customer_code)
    WHERE customer_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS saas_subscriptions_provider_subscription_idx
    ON public.saas_subscriptions(provider, subscription_code)
    WHERE subscription_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.saas_subscription_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('paystack')),
    provider_reference text NOT NULL,
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency text NOT NULL,
    event_type text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_reference)
);

ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their SaaS subscription"
    ON public.saas_subscriptions FOR SELECT
    USING (public.is_member_of(organization_id));

CREATE POLICY "Members can view their SaaS subscription payments"
    ON public.saas_subscription_payments FOR SELECT
    USING (public.is_member_of(organization_id));

CREATE OR REPLACE FUNCTION public.record_saas_subscription_payment(
    p_organization_id uuid,
    p_provider_reference text,
    p_amount_minor bigint,
    p_currency text,
    p_event_type text,
    p_customer_code text DEFAULT NULL,
    p_subscription_code text DEFAULT NULL,
    p_plan_code text DEFAULT NULL,
    p_period_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inserted public.saas_subscription_payments;
    v_current_expiry timestamptz;
    v_base_expiry timestamptz;
    v_new_expiry timestamptz;
BEGIN
    IF p_amount_minor < 350000 OR upper(p_currency) <> 'NGN' THEN
        RAISE EXCEPTION 'Invalid SaaS subscription payment amount or currency';
    END IF;

    INSERT INTO public.saas_subscription_payments (
        organization_id, provider, provider_reference, amount_minor,
        currency, event_type
    )
    VALUES (
        p_organization_id, 'paystack', p_provider_reference, p_amount_minor,
        upper(p_currency), p_event_type
    )
    ON CONFLICT (provider, provider_reference) DO NOTHING
    RETURNING * INTO v_inserted;

    IF v_inserted.id IS NULL THEN
        RETURN jsonb_build_object('duplicate', true);
    END IF;

    SELECT pro_expires_at
      INTO v_current_expiry
      FROM public.organizations
     WHERE id = p_organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    v_base_expiry := GREATEST(COALESCE(v_current_expiry, now()), now());
    v_new_expiry := v_base_expiry + make_interval(days => p_period_days);

    UPDATE public.organizations
       SET is_pro = true,
           pro_expires_at = v_new_expiry,
           updated_at = now()
     WHERE id = p_organization_id;

    INSERT INTO public.saas_subscriptions (
        organization_id, provider, customer_code, subscription_code,
        plan_code, status, current_period_end
    )
    VALUES (
        p_organization_id, 'paystack', p_customer_code, p_subscription_code,
        p_plan_code, 'ACTIVE', v_new_expiry
    )
    ON CONFLICT (organization_id) DO UPDATE SET
        customer_code = COALESCE(EXCLUDED.customer_code, saas_subscriptions.customer_code),
        subscription_code = COALESCE(EXCLUDED.subscription_code, saas_subscriptions.subscription_code),
        plan_code = COALESCE(EXCLUDED.plan_code, saas_subscriptions.plan_code),
        status = 'ACTIVE',
        current_period_end = v_new_expiry,
        updated_at = now();

    RETURN jsonb_build_object(
        'duplicate', false,
        'expires_at', v_new_expiry,
        'organization_id', p_organization_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_saas_subscription_payment(
    uuid, text, bigint, text, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_saas_subscription_payment(
    uuid, text, bigint, text, text, text, text, text, integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.update_saas_subscription_status(
    p_provider text,
    p_customer_code text DEFAULT NULL,
    p_subscription_code text DEFAULT NULL,
    p_status text DEFAULT 'PAST_DUE'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE public.saas_subscriptions
       SET status = p_status,
           updated_at = now()
     WHERE provider = p_provider
       AND (
           (p_subscription_code IS NOT NULL AND subscription_code = p_subscription_code)
           OR (p_customer_code IS NOT NULL AND customer_code = p_customer_code)
       );
$$;

REVOKE ALL ON FUNCTION public.update_saas_subscription_status(
    text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_saas_subscription_status(
    text, text, text, text
) TO service_role;

-- Manual transfer remains available as a fallback while online checkout is
-- being monitored. Persisting the request prevents the confirmation screen
-- from being the only record that a customer asked for a review.
CREATE TABLE IF NOT EXISTS public.manual_upgrade_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_minor bigint NOT NULL DEFAULT 350000,
    currency text NOT NULL DEFAULT 'NGN',
    status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    reviewer_note text
);

CREATE UNIQUE INDEX IF NOT EXISTS manual_upgrade_requests_one_pending_idx
    ON public.manual_upgrade_requests(organization_id)
    WHERE status = 'PENDING';

ALTER TABLE public.manual_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their manual upgrade requests"
    ON public.manual_upgrade_requests FOR SELECT
    USING (public.is_member_of(organization_id));

CREATE OR REPLACE FUNCTION public.submit_manual_upgrade_request()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id uuid;
    v_request_id uuid;
BEGIN
    SELECT organization_id
      INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     ORDER BY created_at
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to an organization';
    END IF;

    INSERT INTO public.manual_upgrade_requests (organization_id, user_id)
    VALUES (v_org_id, auth.uid())
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_request_id;

    IF v_request_id IS NULL THEN
        SELECT id
          INTO v_request_id
          FROM public.manual_upgrade_requests
         WHERE organization_id = v_org_id
           AND status = 'PENDING'
         LIMIT 1;
    END IF;

    RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_manual_upgrade_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_manual_upgrade_request() TO authenticated;
