-- Enable Row Level Security on the api_logs table to satisfy security requirements
-- Since api_logs is only inserted into via the check_and_log_rate_limit SECURITY DEFINER function,
-- no public policies are required. This ensures the table is completely locked down from public access.

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
