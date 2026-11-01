import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFrom, wrapEmailHtml } from "../_shared/email.ts";

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://billreve.app';

// Simple delay function for retries
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  retries = 3,
  orgName?: string | null
): Promise<boolean> {
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set. Skipping email.');
    return false;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Sent as the merchant's business where known, with the standard
          // "Powered by BillReve" footer applied centrally.
          from: buildFrom(orgName),
          to,
          subject,
          html: wrapEmailHtml(html, { orgName })
        })
      });

      if (res.ok) {
        return true;
      }
      
      const errorText = await res.text();
      console.error(`Resend API Error (attempt ${i+1}):`, errorText);
    } catch (err: any) {
      console.error(`Resend Fetch Error (attempt ${i+1}):`, err.message);
    }
    
    if (i < retries - 1) await delay(1000 * (i + 1));
  }
  return false;
}

serve(async (req) => {
  try {
    // Only allow POST requests (e.g. from pg_net)
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Organizations replaced the old profiles table. Join the owner membership
    // because organizations.id is not the same as auth.users.id.
    // Selecting '*' fetches massive base64 logo_urls, causing 500MB+ egress and timeouts.
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id, name, email, email_flags, created_at, is_pro, organization_members!inner(user_id, role)')
      .eq('organization_members.role', 'owner');

    if (error) throw error;
    
    let welcomeSent = 0;
    let day3Sent = 0;

    for (const organization of organizations || []) {
      const owner = organization.organization_members?.[0];
      if (!owner?.user_id) {
        console.warn(`Skipping organization ${organization.id}: no owner membership found.`);
        continue;
      }

      const emailFlags = organization.email_flags || {};
      const createdAt = new Date(organization.created_at);
      const now = new Date();
      
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      // Only check Auth API if they actually qualify for an email to save Auth Egress & Timeouts
      const needsWelcome = !emailFlags.welcome_sent && organization.email;
      const needsDay3 = hoursSinceCreation >= 72 && !emailFlags.day3_sent && !organization.is_pro && organization.email;

      if (!needsWelcome && !needsDay3) continue;

      // Fetch user confirmation status only if needed
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(owner.user_id);
      
      if (userError || !userData?.user) {
        console.error(`Could not fetch auth user for organization ${organization.id}:`, userError?.message);
        continue;
      }
      
      const isConfirmed = !!userData.user.email_confirmed_at;

      // Welcome Email: Send if not sent yet, and email IS confirmed
      if (needsWelcome && isConfirmed) {
        const success = await sendEmailWithRetry(
          organization.email,
          'Welcome to BillReve! 🎉',
          `
            <h2>Welcome aboard, ${organization.name || 'friend'}!</h2>
            <p>We're thrilled to have you join BillReve. You can now start creating professional quotes, managing invoices, and getting paid faster.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p><a href="${frontendUrl}/dashboard">Go to your Dashboard</a></p>
            <p>Best,<br/>The BillReve Team</p>
          `
        );
        
        if (success) {
          welcomeSent++;
          await supabase.from('organizations').update({
            email_flags: { ...emailFlags, welcome_sent: true }
          }).eq('id', organization.id);
        }
      }

      // Day 3 Email: Send if older than 72 hours, not sent, NOT pro, and email IS confirmed
      if (needsDay3 && isConfirmed) {
        const success = await sendEmailWithRetry(
          organization.email,
          'Unlock Your Business Potential with BillReve Pro! 🚀',
          `
            <h2>Hi ${organization.name || 'there'},</h2>
            <p>It's been a few days since you joined BillReve, and we hope you're enjoying the platform!</p>
            <p>Did you know that upgrading to <strong>BillReve Pro</strong> unlocks unlimited clients, premium document templates, and priority support?</p>
            <p><a href="${frontendUrl}/settings">Upgrade to Pro today!</a></p>
            <p>Best,<br/>The BillReve Team</p>
          `
        );
        
        if (success) {
          day3Sent++;
          await supabase.from('organizations').update({
            email_flags: { ...emailFlags, day3_sent: true }
          }).eq('id', organization.id);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: organizations?.length ?? 0,
      welcomeSent,
      day3Sent
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Email worker error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
