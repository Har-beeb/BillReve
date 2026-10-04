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
      FROM (SELECT local_id, status, total, amount_paid, due_date, created_at 
            FROM invoices WHERE user_id = auth.uid() 
            ORDER BY created_at DESC LIMIT 20) i
    )
  )
  FROM invoices WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_context() TO authenticated;
