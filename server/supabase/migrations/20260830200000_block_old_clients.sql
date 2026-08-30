-- Block old cached PWAs from leaking egress by requiring the new x-app-version header

-- Apply to clients table
CREATE POLICY "Block old clients app versions" ON public.clients
AS RESTRICTIVE
FOR SELECT
USING (
  current_setting('request.headers', true)::json->>'x-app-version' = '1.3.1' OR
  current_user = 'postgres'
);

-- Apply to invoices table
CREATE POLICY "Block old invoices app versions" ON public.invoices
AS RESTRICTIVE
FOR SELECT
USING (
  current_setting('request.headers', true)::json->>'x-app-version' = '1.3.1' OR
  current_user = 'postgres'
);

-- Apply to quotes table
CREATE POLICY "Block old quotes app versions" ON public.quotes
AS RESTRICTIVE
FOR SELECT
USING (
  current_setting('request.headers', true)::json->>'x-app-version' = '1.3.1' OR
  current_user = 'postgres'
);