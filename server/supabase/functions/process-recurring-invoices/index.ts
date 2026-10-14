import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { buildFrom, wrapEmailHtml } from "../_shared/email.ts";
import { toMajorString } from "../_shared/money.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://billreve.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Email a generated recurring invoice to the client.
 *
 * Returns true on success. The generated invoice is only promoted from DRAFT
 * to SENT when this succeeds, so a delivery failure leaves a visible draft
 * rather than a silently "sent" invoice the client never received.
 */
const emailRecurringInvoice = async (opts: {
  toEmail: string;
  clientName: string | null;
  orgName: string | null;
  invoiceNumber: string;
  totalMinor: number;
  currency: string | null;
  dueDate: string | null;
  publicLink: string;
}): Promise<boolean> => {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — cannot email recurring invoice.');
    return false;
  }

  const currency = opts.currency || 'NGN';
  const body = `
    <h2 style="color:#4F46E5;margin:0 0 16px 0;">Invoice ${opts.invoiceNumber} from ${opts.orgName || 'your provider'}</h2>
    <p>Hi ${opts.clientName || 'there'},</p>
    <p>Here is your scheduled invoice.</p>
    <p><strong>Amount:</strong> ${currency} ${toMajorString(opts.totalMinor)}</p>
    ${opts.dueDate ? `<p><strong>Due Date:</strong> ${new Date(opts.dueDate).toDateString()}</p>` : ''}
    <div style="margin-top:24px;">
      <a href="${opts.publicLink}" style="background-color:#8b5cf6;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">View &amp; Pay Invoice</a>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: buildFrom(opts.orgName),
        to: [opts.toEmail],
        reply_to: 'support@billreve.app',
        subject: `Invoice ${opts.invoiceNumber} from ${opts.orgName || 'your provider'}`,
        html: wrapEmailHtml(body, { orgName: opts.orgName }),
      }),
    });

    if (!res.ok) {
      console.error('Resend rejected recurring invoice email:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send recurring invoice email:', err);
    return false;
  }
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
        invoices!template_invoice_id(*),
        clients!client_id(name, email),
        organizations!organization_id(name)
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

        // Insert new invoice. `.select()` returns the row AFTER the
        // assign_invoice_number trigger has replaced the DRAFT- placeholder
        // with the real sequential number, which is what the client must see.
        const { data: inserted, error: insertError } = await supabaseClient
          .from('invoices')
          .insert(newInvoice)
          .select('local_id, invoice_number, total, currency, due_date')
          .single();

        if (insertError) throw insertError;

        const assignedNumber = inserted?.invoice_number || draftInvoiceNumber;

        // ---------------------------------------------------------------
        // Send it. Previously the function stopped at the DRAFT insert, so
        // recurring invoices were generated silently and never reached the
        // client — while the UI and docs promised they would be emailed
        // automatically. Promote to SENT only if delivery succeeded.
        // ---------------------------------------------------------------
        const clientRow = (schedule as any).clients;
        const orgRow = (schedule as any).organizations;
        let delivered = false;

        if (clientRow?.email) {
          delivered = await emailRecurringInvoice({
            toEmail: clientRow.email,
            clientName: clientRow.name ?? null,
            orgName: orgRow?.name ?? null,
            invoiceNumber: assignedNumber,
            totalMinor: Number(inserted?.total ?? newInvoice.total ?? 0),
            currency: inserted?.currency ?? newInvoice.currency ?? null,
            dueDate: inserted?.due_date ?? dueDate,
            publicLink: `${FRONTEND_URL}/pay/${newLocalId}`,
          });
        } else {
          console.warn(`Schedule ${schedule.id}: client has no email, leaving invoice as DRAFT.`);
        }

        if (delivered) {
          await supabaseClient
            .from('invoices')
            .update({
              status: 'SENT',
              issued_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('local_id', newLocalId)
            .eq('organization_id', template.organization_id);
        }

        // Tell the merchant either way — a generated-but-undelivered invoice
        // is exactly the thing they need to know about.
        await supabaseClient.from('notifications').insert({
          organization_id: template.organization_id,
          title: delivered ? 'Recurring Invoice Sent' : 'Recurring Invoice Needs Attention',
          message: delivered
            ? `Invoice ${assignedNumber} was generated and emailed to ${clientRow?.name || 'your client'}.`
            : `Invoice ${assignedNumber} was generated but could not be emailed. It is saved as a draft.`,
          type: delivered ? 'INVOICE_SENT' : 'INVOICE_DRAFT',
          entity_id: newLocalId,
        });

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
