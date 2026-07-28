import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { emailService } from './email.js';

const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://tftgkvovzntfkymvbwdz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

// Run every hour to check for Day 3 users
export const startCronJobs = () => {
  if (!supabaseAdmin) {
    console.error("❌ Cron disabled: Missing SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  console.log("⏰ Cron jobs initialized.");

  // Check every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log("⏰ Running Day 3 Marketing Email Check...");
    try {
      // We want to find users who were created more than 3 days ago (approx 72 hours)
      // and haven't received the day3 email.
      // We only want to target those who are NOT on a Pro plan (assuming free plan or no subscription).
      // Since we don't have a subscriptions table yet, we'll just target everyone who hasn't received it.
      
      // Fetch profiles created > 3 days ago
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error("Cron Database Error:", error);
        return;
      }

      // Filter in JS to avoid tricky JSONB NULL evaluations in PostgREST
      const targetProfiles = profiles?.filter(p => !p.email_flags || !p.email_flags.day3_sent) || [];

      if (targetProfiles.length === 0) {
        return;
      }

      for (const profile of targetProfiles) {
        if (!profile.email) continue;
        
        console.log(`Sending Day 3 Marketing Email to ${profile.email}`);
        
        try {
          await emailService.sendMarketingEmail({
            to: profile.email,
            subject: 'Unlock Your Business Potential with BillReve Pro! 🚀',
            html: `
              <h2>Hi ${profile.name || 'there'},</h2>
              <p>It's been a few days since you joined BillReve, and we hope you're enjoying the platform!</p>
              <p>Did you know that upgrading to <strong>BillReve Pro</strong> unlocks unlimited clients, advanced recurring invoices, and priority support?</p>
              <p><a href="${env.FRONTEND_URL || 'https://billreve.app'}/settings">Upgrade to Pro today!</a></p>
              <p>Best,<br/>The BillReve Team</p>
            `
          });
          
          console.log(`✅ Day 3 email sent successfully to: ${profile.email}`);
          
          // Mark as sent
          const updatedFlags = { ...(profile.email_flags || {}), day3_sent: true };
          await supabaseAdmin
            .from('profiles')
            .update({ email_flags: updatedFlags })
            .eq('id', profile.id);
            
        } catch (emailErr) {
          console.error(`❌ Failed to send Day 3 email to ${profile.email}`, emailErr);
        }
      }
      
    } catch (err) {
      console.error("⏰ Cron job failed:", err);
    }
  });

  // Check every 5 minutes for new signups
  cron.schedule('*/5 * * * *', async () => {
    console.log("⏰ Running Welcome Email Check...");
    try {
      // Find users who haven't received a welcome email yet
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*');

      if (error) {
        console.error("Cron Database Error (Welcome):", error);
        return;
      }

      // Filter in JS to avoid NULL evaluation bugs
      const targetProfiles = profiles?.filter(p => !p.email_flags || !p.email_flags.welcome_sent) || [];

      if (targetProfiles.length === 0) {
        return;
      }

      for (const profile of targetProfiles) {
        if (!profile.email) continue;
        
        console.log(`Sending Welcome Email to ${profile.email}`);
        
        try {
          await emailService.sendMarketingEmail({
            to: profile.email,
            subject: 'Welcome to BillReve! 🎉',
            html: `
              <h2>Welcome aboard, ${profile.name || 'friend'}!</h2>
              <p>We're thrilled to have you join BillReve. You can now start creating professional quotes, managing invoices, and getting paid faster.</p>
              <p>If you have any questions, feel free to reach out to our support team.</p>
              <p><a href="${env.FRONTEND_URL || 'https://billreve.app'}/dashboard">Go to your Dashboard</a></p>
              <p>Best,<br/>The BillReve Team</p>
            `
          });
          
          console.log(`✅ Welcome email sent successfully to: ${profile.email}`);
          
          // Mark as sent
          const updatedFlags = { ...(profile.email_flags || {}), welcome_sent: true };
          await supabaseAdmin
            .from('profiles')
            .update({ email_flags: updatedFlags })
            .eq('id', profile.id);
            
        } catch (emailErr) {
          console.error(`❌ Failed to send Welcome email to ${profile.email}`, emailErr);
        }
      }
      
    } catch (err) {
      console.error("⏰ Welcome Cron job failed:", err);
    }
  });
};
