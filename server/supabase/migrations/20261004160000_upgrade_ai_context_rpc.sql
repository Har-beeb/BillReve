-- Upgrade get_ai_context to include human-readable invoice fields
-- (description, invoice_number, client_name) so the AI can produce useful reports
CREATE OR REPLACE FUNCTION public.get_ai_context()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'totalRevenue', COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0),
    'outstanding', COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('SENT','PENDING','PARTIAL','OVERDUE')), 0),
    'overdueCount', COUNT(*) FILTER (WHERE status = 'OVERDUE'),
    'clientCount', (SELECT COUNT(*) FROM clients WHERE user_id = auth.uid() AND deleted_at IS NULL),
    'recentInvoices', (
      SELECT jsonb_agg(row_to_json(i))
      FROM (
        SELECT
          inv.invoice_number,
          inv.description,
          inv.status,
          inv.total,
          inv.amount_paid,
          inv.due_date,
          inv.created_at,
          c.name AS client_name
        FROM invoices inv
        LEFT JOIN clients c ON c.local_id = inv.client_id AND c.user_id = auth.uid()
        WHERE inv.user_id = auth.uid()
        ORDER BY inv.created_at DESC
        LIMIT 25
      ) i
    )
  )
  FROM invoices WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_context() TO authenticated;
