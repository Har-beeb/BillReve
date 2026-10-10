CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add encrypted columns
ALTER TABLE public.user_secrets 
ADD COLUMN paystack_key_encrypted BYTEA,
ADD COLUMN flutterwave_key_encrypted BYTEA;

-- 2. Migrate existing data securely (Fallback to a default key if not configured in Supabase Dashboard)
DO $$
DECLARE
    v_encryption_key TEXT;
BEGIN
    v_encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'billreve_fallback_secret_99');
    
    UPDATE public.user_secrets
    SET 
        paystack_key_encrypted = extensions.pgp_sym_encrypt(paystack_secret_key, v_encryption_key),
        flutterwave_key_encrypted = extensions.pgp_sym_encrypt(flutterwave_secret_key, v_encryption_key)
    WHERE paystack_secret_key IS NOT NULL OR flutterwave_secret_key IS NOT NULL;
END $$;

-- 3. Drop plaintext columns
ALTER TABLE public.user_secrets 
DROP COLUMN paystack_secret_key,
DROP COLUMN flutterwave_secret_key;


-- 4. Create RPC to GET secrets for the authenticated user
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


-- 5. Create RPC to SET secrets for the authenticated user
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


-- 6. Create RPC for Webhooks (Service Role Only) to get decrypted secret
CREATE OR REPLACE FUNCTION public.get_merchant_secret(
    p_user_id UUID,
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

-- Revoke execute from anon just in case, though they can't do much without auth.uid()
REVOKE EXECUTE ON FUNCTION public.get_user_secrets() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_secrets(TEXT, TEXT) FROM anon;

-- VERY IMPORTANT: Webhook RPC should only be accessible by the service_role
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_secret(UUID, TEXT) TO service_role;
