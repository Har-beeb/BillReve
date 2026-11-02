-- Store Flutterwave's API Secret Key separately from the webhook Secret Hash.
--
-- Flutterwave uses the Secret Hash to authenticate webhook delivery and the
-- Secret Key to verify a transaction through the provider API. They are
-- different credentials and must not share one encrypted column.

ALTER TABLE public.user_secrets
  ADD COLUMN IF NOT EXISTS flutterwave_api_key_encrypted bytea;

DROP FUNCTION IF EXISTS public.get_user_secrets();
CREATE OR REPLACE FUNCTION public.get_user_secrets()
RETURNS TABLE (
    paystack_secret_key TEXT,
    flutterwave_secret_key TEXT,
    flutterwave_api_secret_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        CASE WHEN flutterwave_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_key_encrypted, v_encryption_key) END,
        CASE WHEN flutterwave_api_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_api_key_encrypted, v_encryption_key) END
    FROM public.user_secrets
    WHERE organization_id = v_org_id;
END;
$$;

DROP FUNCTION IF EXISTS public.set_user_secrets(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.set_user_secrets(
    p_paystack TEXT,
    p_flutterwave TEXT,
    p_flutterwave_api TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    INSERT INTO public.user_secrets (
        organization_id,
        paystack_key_encrypted,
        flutterwave_key_encrypted,
        flutterwave_api_key_encrypted,
        updated_at
    )
    VALUES (
        v_org_id,
        CASE WHEN p_paystack IS NULL THEN NULL ELSE extensions.pgp_sym_encrypt(p_paystack, v_encryption_key) END,
        CASE WHEN p_flutterwave IS NULL THEN NULL ELSE extensions.pgp_sym_encrypt(p_flutterwave, v_encryption_key) END,
        CASE WHEN p_flutterwave_api IS NULL THEN NULL ELSE extensions.pgp_sym_encrypt(p_flutterwave_api, v_encryption_key) END,
        now()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
        paystack_key_encrypted = EXCLUDED.paystack_key_encrypted,
        flutterwave_key_encrypted = EXCLUDED.flutterwave_key_encrypted,
        flutterwave_api_key_encrypted = EXCLUDED.flutterwave_api_key_encrypted,
        updated_at = now();
END;
$$;

DROP FUNCTION IF EXISTS public.get_merchant_secret(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.get_merchant_secret(
    p_org_id UUID,
    p_gateway TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_encryption_key TEXT;
    v_secret TEXT;
BEGIN
    v_encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'billreve_fallback_secret_99');

    IF p_gateway = 'paystack' THEN
        SELECT CASE WHEN paystack_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(paystack_key_encrypted, v_encryption_key) END
          INTO v_secret FROM public.user_secrets WHERE organization_id = p_org_id;
    ELSIF p_gateway = 'flutterwave' THEN
        SELECT CASE WHEN flutterwave_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_key_encrypted, v_encryption_key) END
          INTO v_secret FROM public.user_secrets WHERE organization_id = p_org_id;
    ELSIF p_gateway = 'flutterwave_api' THEN
        SELECT CASE WHEN flutterwave_api_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_api_key_encrypted, v_encryption_key) END
          INTO v_secret FROM public.user_secrets WHERE organization_id = p_org_id;
    ELSE
        RAISE EXCEPTION 'Unknown gateway';
    END IF;

    RETURN v_secret;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_secrets() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_secrets(TEXT, TEXT, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.set_user_secrets(TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_secrets(TEXT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_secrets(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) TO service_role;
