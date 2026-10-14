-- =============================================================================
-- 20261013000000_enrich_ai_context.sql
--
-- Fixes RevenueChat being unable to perform its advertised functions.
--
-- THE MISMATCH
-- The `ai` edge function's system prompt instructs the model to:
--   * "/client — summarize all clients"
--   * "/quote  — summarize recent quotes"
--   * "Client Existence Validation: YOU MUST verify the client exists in the
--      JSON data" before emitting a CREATE action
--   * resolve "@ClientName" mentions
--   * emit DELETE_INVOICE / SEND_DOCUMENT actions carrying a document id
--
-- But `get_ai_context()` returned only:
--   totalRevenue, outstanding, overdueCount, clientCount (a NUMBER), and 25
--   recentInvoices with NO local_id and NO client_id.
--
-- So there was no client list to search, no quotes at all, and no ids to act
-- on. The model could never produce a valid `payload.clientId`, which made
-- RevenueChat's handleExecuteAction fall into its "I need a client to assign
-- this to!" early return every single time. Every symptom the user reported —
-- slash commands not listing, creation "not smooth" — traces back to here.
--
-- PRIVACY: client email, phone and address are deliberately NOT included. The
-- system prompt tells the model those are withheld for security and that it
-- must direct the user to the Clients page to view them; that promise is kept.
-- Only id, name and aggregate money are exposed.
--
-- UNITS: all money stays in BIGINT minor units. The `ai` edge function runs
-- convertMoneyFieldsToMajor() over this payload before prompting, so the model
-- sees human figures.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_ai_context()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_org_id   uuid;
    v_currency text;
BEGIN
    SELECT organization_id INTO v_org_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
     LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object(
            'totalRevenue',    0,
            'outstanding',     0,
            'overdueCount',    0,
            'clientCount',     0,
            'clients',         '[]'::jsonb,
            'recentInvoices',  '[]'::jsonb,
            'recentQuotes',    '[]'::jsonb
        );
    END IF;

    SELECT currency INTO v_currency FROM public.organizations WHERE id = v_org_id;

    RETURN jsonb_build_object(
        'currency', COALESCE(v_currency, 'NGN'),

        -- Headline metrics
        'totalRevenue', COALESCE((
            SELECT SUM(total) FROM public.invoices
             WHERE organization_id = v_org_id AND deleted_at IS NULL AND status = 'PAID'
        ), 0),
        'outstanding', COALESCE((
            SELECT SUM(total - COALESCE(amount_paid, 0)) FROM public.invoices
             WHERE organization_id = v_org_id AND deleted_at IS NULL
               AND status IN ('SENT','PENDING','PARTIAL','OVERDUE')
        ), 0),
        'overdueCount', COALESCE((
            SELECT COUNT(*) FROM public.invoices
             WHERE organization_id = v_org_id AND deleted_at IS NULL AND status = 'OVERDUE'
        ), 0),
        'clientCount', COALESCE((
            SELECT COUNT(*) FROM public.clients
             WHERE organization_id = v_org_id AND deleted_at IS NULL
        ), 0),

        -- The client DIRECTORY. `id` is the local_id, which is exactly what a
        -- CREATE_INVOICE / CREATE_QUOTE action must put in payload.clientId.
        'clients', COALESCE((
            SELECT jsonb_agg(row_to_json(c))
              FROM (
                SELECT cl.local_id AS id,
                       cl.name,
                       (SELECT COUNT(*) FROM public.invoices i
                         WHERE i.organization_id = v_org_id
                           AND i.client_id = cl.local_id
                           AND i.deleted_at IS NULL) AS "invoiceCount",
                       COALESCE((SELECT SUM(i.amount_paid) FROM public.invoices i
                                  WHERE i.organization_id = v_org_id
                                    AND i.client_id = cl.local_id
                                    AND i.deleted_at IS NULL), 0) AS "totalPaid",
                       COALESCE((SELECT SUM(i.total - COALESCE(i.amount_paid, 0)) FROM public.invoices i
                                  WHERE i.organization_id = v_org_id
                                    AND i.client_id = cl.local_id
                                    AND i.deleted_at IS NULL
                                    AND i.status IN ('SENT','PENDING','PARTIAL','OVERDUE')), 0) AS "outstanding"
                  FROM public.clients cl
                 WHERE cl.organization_id = v_org_id
                   AND cl.deleted_at IS NULL
                 ORDER BY cl.name
                 LIMIT 200
              ) c
        ), '[]'::jsonb),

        -- Recent invoices, now WITH ids so actions can target them.
        'recentInvoices', COALESCE((
            SELECT jsonb_agg(row_to_json(i))
              FROM (
                SELECT inv.local_id AS id,
                       inv.invoice_number,
                       inv.description,
                       inv.status,
                       inv.total,
                       inv.amount_paid,
                       inv.currency,
                       inv.due_date,
                       inv.created_at,
                       inv.client_id,
                       c.name AS client_name
                  FROM public.invoices inv
                  LEFT JOIN public.clients c
                         ON c.local_id = inv.client_id
                        AND c.organization_id = v_org_id
                 WHERE inv.organization_id = v_org_id
                   AND inv.deleted_at IS NULL
                 ORDER BY inv.created_at DESC
                 LIMIT 25
              ) i
        ), '[]'::jsonb),

        -- Quotes were absent entirely, so "/quote" could never work.
        'recentQuotes', COALESCE((
            SELECT jsonb_agg(row_to_json(q))
              FROM (
                SELECT qt.local_id AS id,
                       qt.quote_number,
                       qt.description,
                       qt.status,
                       qt.total,
                       qt.counter_amount,
                       qt.currency,
                       qt.expires_at,
                       qt.created_at,
                       qt.client_id,
                       c.name AS client_name
                  FROM public.quotes qt
                  LEFT JOIN public.clients c
                         ON c.local_id = qt.client_id
                        AND c.organization_id = v_org_id
                 WHERE qt.organization_id = v_org_id
                   AND qt.deleted_at IS NULL
                 ORDER BY qt.created_at DESC
                 LIMIT 25
              ) q
        ), '[]'::jsonb)
    );
END;
$$;

ALTER FUNCTION public.get_ai_context() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_ai_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_context() TO authenticated;

NOTIFY pgrst, 'reload schema';
