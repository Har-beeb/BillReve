import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') as string;

serve(async (req) => {
  // We only want this to run via internal CRON, but we can verify a secret token if calling via HTTP
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Overdue Invoices (3, 7, 14 days overdue)
    // For simplicity, we just fetch all overdue invoices that haven't been reminded recently.
    // In a production app, we would track `last_reminded_at` to avoid spamming.
    const { data: overdueInvoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, client:clients(name, email), profile:profiles(business_name, email)')
      .eq('status', 'OVERDUE');

    if (invoiceError) throw invoiceError;

    const emailsToSend = [];

    for (const invoice of overdueInvoices) {
      // Calculate days overdue
      const dueDate = new Date(invoice.due_date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Send reminders at specific intervals
      if (diffDays === 3 || diffDays === 7 || diffDays === 14) {
        emailsToSend.push({
          from: 'BillReve <hello@billreve.app>', // Verified domain
          to: [invoice.client.email],
          subject: `Reminder: Invoice ${invoice.invoice_number} is Overdue`,
          html: `
            <p>Hi ${invoice.client.name},</p>
            <p>This is a friendly reminder that your invoice <strong>${invoice.invoice_number}</strong> for <strong>${invoice.currency} ${invoice.total}</strong> was due on ${dueDate.toDateString()}.</p>
            <p>Please arrange payment as soon as possible.</p>
            <p>Best regards,<br>${invoice.profile?.business_name || 'Your Provider'}</p>
          `
        });
      }
    }

    // 2. Send emails via Resend
    let sentCount = 0;
    for (const email of emailsToSend) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify(email)
      });
      
      if (res.ok) {
        sentCount++;
      } else {
        const err = await res.text();
        console.error(`Failed to send email to ${email.to}:`, err);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: overdueInvoices.length,
      emailsSent: sentCount 
    }), { status: 200 });

  } catch (error: any) {
    console.error('Cron error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
