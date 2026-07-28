-- Create Webhook Logs Table for Observability

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL, -- e.g., 'paystack', 'flutterwave'
    event_type TEXT,
    payload JSONB,
    status TEXT NOT NULL, -- 'success', 'error'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but restrict all client access (only backend Service Role can insert/view)
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- No policies created, meaning anon and authenticated users have no access.
