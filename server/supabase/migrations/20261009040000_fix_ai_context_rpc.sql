-- Fix get_ai_context to use organization_id instead of user_id
CREATE OR REPLACE FUNCTION public.get_ai_context()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id uuid;
BEGIN
    -- Get the user's active organization
    SELECT organization_id INTO v_org_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
    LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object(
            'totalRevenue', 0,
            'outstanding', 0,
            'overdueCount', 0,
            'clientCount', 0,
            'recentInvoices', '[]'::jsonb
        );
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'totalRevenue', COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0),
            'outstanding', COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('SENT','PENDING','PARTIAL','OVERDUE')), 0),
            'overdueCount', COUNT(*) FILTER (WHERE status = 'OVERDUE'),
            'clientCount', (SELECT COUNT(*) FROM public.clients WHERE organization_id = v_org_id AND deleted_at IS NULL),
            'recentInvoices', COALESCE((
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
                FROM public.invoices inv
                LEFT JOIN public.clients c ON c.local_id = inv.client_id AND c.organization_id = v_org_id
                WHERE inv.organization_id = v_org_id
                ORDER BY inv.created_at DESC
                LIMIT 25
            ) i
            ), '[]'::jsonb)
        )
        FROM public.invoices WHERE organization_id = v_org_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_context() TO authenticated;
