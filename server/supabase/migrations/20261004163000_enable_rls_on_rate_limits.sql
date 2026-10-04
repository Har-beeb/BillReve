-- Enable Row Level Security (RLS) on public.rate_limits
-- Since this table is strictly used internally via the SECURITY DEFINER RPC functions
-- (like check_rate_limit), we don't need to add any ALLOW policies. 
-- Enabling RLS with no policies effectively blocks all direct access from the REST API.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
