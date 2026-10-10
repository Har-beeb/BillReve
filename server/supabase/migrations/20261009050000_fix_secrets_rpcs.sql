-- Fix secrets RPCs to use organization_id instead of user_id

-- 1. Create RPC to GET secrets for the authenticated user
CREATE OR REPLACE FUNCTION public.get_user_secrets()
RETURNS TABLE (
    paystack_secret_key TEXT,
    flutterwave_secret_key TEXT
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
        CASE WHEN flutterwave_key_encrypted IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(flutterwave_key_encrypted, v_encryption_key) END
    FROM public.user_secrets
    WHERE organization_id = v_org_id;
END;
$$;


-- 2. Create RPC to SET secrets for the authenticated user
CREATE OR REPLACE FUNCTION public.set_user_secrets(
    p_paystack TEXT,
    p_flutterwave TEXT
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


-- 3. Create RPC for Webhooks (Service Role Only) to get decrypted secret
DROP FUNCTION IF EXISTS public.get_merchant_secret(UUID, TEXT);
-- Notice: We change p_user_id to p_org_id UUID to reflect the new architecture
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

-- Drop the old get_merchant_secret that used user_id just in case


-- Very important: reset execute permissions
REVOKE EXECUTE ON FUNCTION public.get_user_secrets() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_secrets(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) TO service_role;
