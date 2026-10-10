import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch all ACTIVE recurring schedules that are due today or earlier
    const today = new Date().toISOString().split('T')[0];
    
    const { data: schedules, error: scheduleError } = await supabaseClient
      .from('recurring_schedules')
      .select(`
        *,
        invoices!template_invoice_id(*)
      `)
      .eq('status', 'ACTIVE')
      .lte('next_run_date', today);

    if (scheduleError) {
      throw new Error(`Failed to fetch schedules: ${scheduleError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No active schedules due today." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    // 2. Process each schedule
    for (const schedule of schedules) {
      try {
        const template = schedule.invoices;
        if (!template) {
          throw new Error(`Template invoice not found for schedule ${schedule.id}`);
        }

        // Generate new local_id (UUID v4)
        const newLocalId = crypto.randomUUID();
        
        // Use a generic draft ID for now; sync engine sequence triggers will assign the real INV- number
        const draftInvoiceNumber = `DRAFT-INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Calculate new Due Date based on original duration
        let dueDate = null;
        if (template.due_date) {
          const originalDuration = new Date(template.due_date).getTime() - new Date(template.created_at).getTime();
          dueDate = new Date(Date.now() + originalDuration).toISOString().split('T')[0];
        }

        const newInvoice = {
          local_id: newLocalId,
          organization_id: template.organization_id,
          client_id: template.client_id,
          invoice_number: draftInvoiceNumber,
          status: 'DRAFT',
          currency: template.currency,
          subtotal: template.subtotal,
          total: template.total,
          amount_paid: 0,
          taxes: template.taxes,
          items: template.items,
          notes: template.notes,
          bank_account_id: template.bank_account_id,
          bank_account_snapshot: template.bank_account_snapshot,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          due_date: dueDate
        };

        // Insert new invoice
        const { error: insertError } = await supabaseClient
          .from('invoices')
          .insert(newInvoice);

        if (insertError) throw insertError;

        // Calculate next run date
        const currentRunDate = new Date(schedule.next_run_date);
        if (schedule.frequency === 'WEEKLY') {
          currentRunDate.setDate(currentRunDate.getDate() + 7);
        } else if (schedule.frequency === 'MONTHLY') {
          currentRunDate.setMonth(currentRunDate.getMonth() + 1);
        } else if (schedule.frequency === 'YEARLY') {
          currentRunDate.setFullYear(currentRunDate.getFullYear() + 1);
        }
        
        const nextRunDateStr = currentRunDate.toISOString().split('T')[0];
        
        let newStatus = 'ACTIVE';
        if (schedule.end_date && nextRunDateStr > schedule.end_date) {
          newStatus = 'COMPLETED';
        }

        // Update schedule
        const { error: updateError } = await supabaseClient
          .from('recurring_schedules')
          .update({
            next_run_date: nextRunDateStr,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', schedule.id);

        if (updateError) throw updateError;
        
        processedCount++;
      } catch (err: any) {
        errors.push(`Schedule ${schedule.id} failed: ${err.message}`);
      }
    }

    return new Response(JSON.stringify({ 
      message: `Processed ${processedCount} schedules.`,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
