import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://billreve.app';

// Simple delay function for retries
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendEmailWithRetry(to: string, subject: string, html: string, retries = 3): Promise<boolean> {
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
          from: Deno.env.get('RESEND_FROM_EMAIL') || 'BillReve <hello@billreve.app>',
          to,
          subject,
          html
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

    // Get all profiles to process
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) throw error;
    
    let welcomeSent = 0;
    let day3Sent = 0;

    for (const profile of profiles) {
      const emailFlags = profile.email_flags || {};
      const createdAt = new Date(profile.created_at);
      const now = new Date();
      
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      // Fetch user confirmation status
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id);
      
      if (userError || !userData.user) {
        console.error(`Could not fetch auth user for profile ${profile.id}:`, userError?.message);
        continue;
      }
      
      const isConfirmed = !!userData.user.email_confirmed_at;

      // Welcome Email: Send if not sent yet, and email IS confirmed
      if (!emailFlags.welcome_sent && profile.email && isConfirmed) {
        const success = await sendEmailWithRetry(
          profile.email,
          'Welcome to BillReve! 🎉',
          `
            <h2>Welcome aboard, ${profile.name || 'friend'}!</h2>
            <p>We're thrilled to have you join BillReve. You can now start creating professional quotes, managing invoices, and getting paid faster.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p><a href="${frontendUrl}/dashboard">Go to your Dashboard</a></p>
            <p>Best,<br/>The BillReve Team</p>
          `
        );
        
        if (success) {
          welcomeSent++;
          await supabase.from('profiles').update({
            email_flags: { ...emailFlags, welcome_sent: true }
          }).eq('id', profile.id);
        }
      }

      // Day 3 Email: Send if older than 72 hours, not sent, NOT pro, and email IS confirmed
      if (hoursSinceCreation >= 72 && !emailFlags.day3_sent && !profile.is_pro && profile.email && isConfirmed) {
        const success = await sendEmailWithRetry(
          profile.email,
          'Unlock Your Business Potential with BillReve Pro! 🚀',
          `
            <h2>Hi ${profile.name || 'there'},</h2>
            <p>It's been a few days since you joined BillReve, and we hope you're enjoying the platform!</p>
            <p>Did you know that upgrading to <strong>BillReve Pro</strong> unlocks unlimited clients, advanced recurring invoices, and priority support?</p>
            <p><a href="${frontendUrl}/settings">Upgrade to Pro today!</a></p>
            <p>Best,<br/>The BillReve Team</p>
          `
        );
        
        if (success) {
          day3Sent++;
          await supabase.from('profiles').update({
            email_flags: { ...emailFlags, day3_sent: true }
          }).eq('id', profile.id);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: profiles.length,
      welcomeSent,
      day3Sent
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Email worker error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
