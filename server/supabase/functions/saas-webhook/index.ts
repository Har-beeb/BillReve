import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

// The master secret key for the SaaS owner (You)
const saasSecretKey = Deno.env.get('SAAS_PAYSTACK_SECRET_KEY') as string;

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let logId: string | null = null;
  let bodyText = '';

  try {
    bodyText = await req.text();
    let payload = {};
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      // Not JSON
    }

    // 1. Log incoming webhook immediately
    const { data: logEntry } = await supabase
      .from('webhook_logs')
      .insert({
        provider: 'paystack',
        event_type: (payload as any).event || 'unknown',
        payload: payload,
        status: 'processing'
      })
      .select('id')
      .single();
      
    if (logEntry) logId = logEntry.id;

    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      throw new Error('No signature');
    }
    
    // Verify SaaS Paystack Signature
    const hash = createHmac('sha512', saasSecretKey)
      .update(bodyText)
      .digest('hex');

    if (hash !== signature) {
      throw new Error('Invalid signature');
    }

    const event = JSON.parse(bodyText);

    // Handle successful subscription payment
    if (event.event === 'charge.success') {
      const data = event.data;
      
      // Paystack puts custom fields in an array under metadata.custom_fields
      let userId = '';
      let type = '';
      
      if (data.metadata && data.metadata.custom_fields) {
        for (const field of data.metadata.custom_fields) {
          if (field.variable_name === 'userId') userId = field.value;
          if (field.variable_name === 'type') type = field.value;
        }
      }
      
      // If the charge was for a subscription
      if (userId && type === 'saas_subscription') {
        // Update the user's profile to is_pro = true and add 30 days
        const { error } = await supabase
          .from('profiles')
          .update({ 
            is_pro: true,
            pro_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', userId);

        if (error) {
          throw new Error(`Failed to update user profile: ${error.message}`);
        }
        
        console.log(`User ${userId} successfully upgraded to PRO.`);

        // Fetch user email for the welcome email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', userId)
          .single();

        if (profile?.email) {
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (resendApiKey) {
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: Deno.env.get('RESEND_FROM_EMAIL') || 'BillReve <noreply@billreve.app>',
                to: profile.email,
                subject: 'Welcome to BillReve Pro! 🚀',
                html: `
                  <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
                    <h2>Welcome to BillReve Pro, ${profile.name || 'Awesome User'}!</h2>
                    <p>Your subscription payment was successful, and your account has been automatically upgraded.</p>
                    <p>You can now:</p>
                    <ul>
                      <li>Accept international payments via Flutterwave</li>
                      <li>Automate email reminders for overdue invoices</li>
                      <li>Remove BillReve branding from your public invoices</li>
                    </ul>
                    <p>Log back into your account to explore your new tools.</p>
                    <p>Best,<br>The BillReve Team</p>
                  </div>
                `
              })
            });
            
            if (!emailResponse.ok) {
              console.error('Failed to send welcome email', await emailResponse.text());
            } else {
              console.log('Welcome email sent successfully to:', profile.email);
            }
          } else {
            console.warn('RESEND_API_KEY is not set in Edge Function secrets, skipping email.');
          }
        }
      } else {
        throw new Error(`Ignored charge.success: Missing userId or type is not saas_subscription (Found type: ${type})`);
      }
    } else if (event.event === 'subscription.disable' || event.event === 'charge.failed' || event.event === 'subscription.not_renew') {
      const data = event.data;
      
      let userId = '';
      let type = '';
      
      if (data.metadata && data.metadata.custom_fields) {
        for (const field of data.metadata.custom_fields) {
          if (field.variable_name === 'userId') userId = field.value;
          if (field.variable_name === 'type') type = field.value;
        }
      }
      
      if (userId && type === 'saas_subscription') {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            is_pro: false,
            pro_expires_at: null 
          })
          .eq('id', userId);

        if (error) {
          throw new Error(`Failed to downgrade user profile: ${error.message}`);
        }
        
        console.log(`User ${userId} successfully downgraded to FREE tier.`);
      }
    }

    // Mark log as success
    if (logId) {
      await supabase.from('webhook_logs').update({ status: 'success' }).eq('id', logId);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    
    // Mark log as error
    if (logId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseFallback = createClient(supabaseUrl, supabaseServiceKey);
      await supabaseFallback.from('webhook_logs').update({ 
        status: 'error',
        error_message: error.message 
      }).eq('id', logId);
    }
    
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
