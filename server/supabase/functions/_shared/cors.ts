/**
 * Canonical CORS headers for all BillReve Edge Functions.
 *
 * WHY THIS EXISTS: eleven functions each hand-rolled their own header list, and
 * `campaign-worker` and `process-recurring-invoices` drifted — they omitted
 * `x-app-version`, which the client sends on every request. A preflight that
 * does not allow a header the request actually carries fails with:
 *
 *   Request header field x-app-version is not allowed by
 *   Access-Control-Allow-Headers in preflight response
 *
 * and the browser blocks the call before it is ever made. Import this instead
 * of writing the object inline.
 *
 * The header list must cover everything the browser sends:
 *   authorization    — the Supabase bearer token or CRON_SECRET
 *   apikey           — supabase-js always sends the anon key
 *   x-client-info    — supabase-js client metadata
 *   content-type     — JSON bodies; triggers preflight on its own
 *   x-app-version    — BillReve's own version header
 *
 * NOTE: `Access-Control-Allow-Origin: '*'` is safe here because these functions
 * authenticate via the Authorization header rather than cookies, so there is no
 * ambient credential to steal. If cookie-based auth is ever introduced, this
 * must become an explicit origin allow-list.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/** Standard JSON response carrying the CORS headers. */
export const jsonResponse = (
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });

/**
 * Preflight short-circuit. Every function should begin with this so OPTIONS is
 * answered without doing any work — and so the response carries the same
 * headers as the real one.
 */
export const handlePreflight = (req: Request): Response | null =>
  req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
