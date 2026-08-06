CREATE TABLE IF NOT EXISTS public.api_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    endpoint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_logs_rate_limit ON public.api_logs (user_id, endpoint, created_at);

-- Function to check rate limit and insert log if allowed
CREATE OR REPLACE FUNCTION check_and_log_rate_limit(p_user_id UUID, p_endpoint TEXT, p_limit INT, p_window_minutes INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.api_logs
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint
      AND created_at >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;
      
    IF v_count < p_limit THEN
        INSERT INTO public.api_logs (user_id, endpoint) VALUES (p_user_id, p_endpoint);
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
