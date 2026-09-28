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

    // Fetch Invoices that are NOT Draft and NOT Paid
    // For a real production app, we should also filter out 'PENDING' since they claim to have paid
    const { data: invoicesToCheck, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, client:clients(name, email), profile:profiles(business_name, email)')
      .in('status', ['SENT', 'OVERDUE']);

    if (invoiceError) throw invoiceError;

    const emailsToSend = [];
    const invoicesToUpdate = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to midnight for pure day math

    for (const invoice of invoicesToCheck) {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      const lastRemindedDate = invoice.last_reminded_at ? new Date(invoice.last_reminded_at) : null;
      if (lastRemindedDate) {
        lastRemindedDate.setHours(0, 0, 0, 0);
        // If we already sent a reminder today, skip this invoice completely
        if (lastRemindedDate.getTime() === today.getTime()) {
          continue;
        }
      }

      // Calculate difference in days (negative = upcoming, 0 = due today, positive = overdue)
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let emailType = null;
      let emailSubject = '';
      let emailBody = '';

      if (diffDays === -3 && invoice.status === 'SENT') {
        emailType = 'upcoming';
        emailSubject = `Upcoming Reminder: Invoice ${invoice.invoice_number} is due in 3 days`;
        emailBody = `
          <p>Hi ${invoice.client.name},</p>
          <p>This is a polite reminder that your invoice <strong>${invoice.invoice_number}</strong> for <strong>${invoice.currency} ${invoice.total}</strong> is due on ${dueDate.toDateString()}.</p>
          <p>Thank you for your business!</p>
        `;
      } else if (diffDays === 0 && invoice.status === 'SENT') {
        emailType = 'due_today';
        emailSubject = `Due Today: Invoice ${invoice.invoice_number}`;
        emailBody = `
          <p>Hi ${invoice.client.name},</p>
          <p>This is a reminder that your invoice <strong>${invoice.invoice_number}</strong> for <strong>${invoice.currency} ${invoice.total}</strong> is due today.</p>
          <p>Please arrange payment at your earliest convenience.</p>
        `;
      } else if ((diffDays === 3 || diffDays === 7 || diffDays === 14) && invoice.status === 'OVERDUE') {
        emailType = 'overdue';
        emailSubject = `Overdue Reminder: Invoice ${invoice.invoice_number}`;
        emailBody = `
          <p>Hi ${invoice.client.name},</p>
          <p>This is a friendly reminder that your invoice <strong>${invoice.invoice_number}</strong> for <strong>${invoice.currency} ${invoice.total}</strong> was due on ${dueDate.toDateString()} and is now overdue.</p>
          <p>Please arrange payment as soon as possible.</p>
        `;
      }

      if (emailType) {
        emailsToSend.push({
          from: 'BillReve <noreply@billreve.app>',
          to: [invoice.client.email],
          subject: emailSubject,
          html: `
            ${emailBody}
            <p>Best regards,<br>${invoice.profile?.business_name || 'Your Provider'}</p>
          `
        });
        invoicesToUpdate.push(invoice.id);
      }
    }

    // Update last_reminded_at for all processed invoices
    if (invoicesToUpdate.length > 0) {
      await supabase
        .from('invoices')
        .update({ last_reminded_at: new Date().toISOString() })
        .in('id', invoicesToUpdate);
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

    // Sweep expired pro subscriptions as a failsafe
    await supabase
      .from('profiles')
      .update({ is_pro: false, pro_expires_at: null })
      .eq('is_pro', true)
      .lt('pro_expires_at', new Date().toISOString());

    return new Response(JSON.stringify({ 
      success: true, 
      processed: invoicesToCheck ? invoicesToCheck.length : 0,
      emailsSent: sentCount 
    }), { status: 200 });

  } catch (error: any) {
    console.error('Cron error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
