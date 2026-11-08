-- Add server-owned pricing and duration rules for prepaid Pro terms.
-- The browser submits only the plan code; amounts and entitlement periods are
-- resolved and validated here.

ALTER TABLE public.manual_upgrade_requests
    ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'pro_monthly',
    ADD COLUMN IF NOT EXISTS period_days integer NOT NULL DEFAULT 30;

ALTER TABLE public.manual_upgrade_requests
    DROP CONSTRAINT IF EXISTS manual_upgrade_requests_plan_code_check,
    DROP CONSTRAINT IF EXISTS manual_upgrade_requests_period_days_check;

ALTER TABLE public.manual_upgrade_requests
    ADD CONSTRAINT manual_upgrade_requests_plan_code_check
        CHECK (plan_code IN ('pro_monthly', 'pro_3_months', 'pro_6_months', 'pro_12_months')),
    ADD CONSTRAINT manual_upgrade_requests_period_days_check
        CHECK (period_days IN (30, 90, 180, 365));

DROP FUNCTION IF EXISTS public.submit_manual_upgrade_request();

CREATE OR REPLACE FUNCTION public.submit_manual_upgrade_request(
    p_plan_code text DEFAULT 'pro_monthly'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id uuid;
    v_request_id uuid;
    v_amount_minor bigint;
    v_period_days integer;
BEGIN
    CASE p_plan_code
        WHEN 'pro_monthly' THEN
            v_amount_minor := 350000;
            v_period_days := 30;
        WHEN 'pro_3_months' THEN
            v_amount_minor := 1000000;
            v_period_days := 90;
        WHEN 'pro_6_months' THEN
            v_amount_minor := 1900000;
            v_period_days := 180;
        WHEN 'pro_12_months' THEN
            v_amount_minor := 3500000;
            v_period_days := 365;
        ELSE
            RAISE EXCEPTION 'Invalid Pro plan';
    END CASE;

    SELECT organization_id
      INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     ORDER BY created_at
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to an organization';
    END IF;

    INSERT INTO public.manual_upgrade_requests (
        organization_id, user_id, amount_minor, plan_code, period_days
    )
    VALUES (
        v_org_id, auth.uid(), v_amount_minor, p_plan_code, v_period_days
    )
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

REVOKE ALL ON FUNCTION public.submit_manual_upgrade_request(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_manual_upgrade_request(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_saas_subscription_payment(
    p_organization_id uuid,
    p_provider_reference text,
    p_amount_minor bigint,
    p_currency text,
    p_event_type text,
    p_customer_code text DEFAULT NULL,
    p_subscription_code text DEFAULT NULL,
    p_plan_code text DEFAULT 'pro_monthly',
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
    v_expected_amount bigint;
    v_expected_days integer;
BEGIN
    CASE p_plan_code
        WHEN 'pro_monthly' THEN
            v_expected_amount := 350000;
            v_expected_days := 30;
        WHEN 'pro_3_months' THEN
            v_expected_amount := 1000000;
            v_expected_days := 90;
        WHEN 'pro_6_months' THEN
            v_expected_amount := 1900000;
            v_expected_days := 180;
        WHEN 'pro_12_months' THEN
            v_expected_amount := 3500000;
            v_expected_days := 365;
        ELSE
            RAISE EXCEPTION 'Invalid Pro plan';
    END CASE;

    IF p_amount_minor <> v_expected_amount
       OR p_period_days <> v_expected_days
       OR upper(p_currency) <> 'NGN' THEN
        RAISE EXCEPTION 'Invalid SaaS subscription payment for plan %', p_plan_code;
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
    v_new_expiry := v_base_expiry + make_interval(days => v_expected_days);

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
        plan_code = EXCLUDED.plan_code,
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
