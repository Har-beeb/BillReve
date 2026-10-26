import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

// The master secret key for the SaaS owner. It must remain an Edge Function
// secret; only the matching public key is exposed in the client build.
const saasSecretKey = Deno.env.get('SAAS_PAYSTACK_SECRET_KEY');

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let logId: string | null = null;
  let bodyText = '';

  try {
    bodyText = await req.text();

    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      throw new Error('No signature');
    }
    if (!saasSecretKey) {
      throw new Error('SAAS_PAYSTACK_SECRET_KEY is not configured');
    }
    
    // 1. Verify SaaS Paystack Signature BEFORE anything else
    const hash = createHmac('sha512', saasSecretKey)
      .update(bodyText)
      .digest('hex');

    if (hash !== signature) {
      throw new Error('Invalid signature');
    }

    let payload = {};
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      throw new Error('Invalid JSON');
    }

    // 2. Log incoming webhook safely now that it is authenticated
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
      // Also accept flat metadata keys, which are simpler for the client to set
      // and less error-prone to read than digging through custom_fields.
      userId = userId || data.metadata?.userId || data.metadata?.user_id || '';
      type = type || data.metadata?.type || '';

      const reference = data.reference ?? data.id;
      const customerCode = data.customer?.customer_code ?? data.customer_code ?? null;
      const subscriptionCode =
        data.subscription_code ??
        data.subscription?.subscription_code ??
        null;
      const planCode = data.plan?.plan_code ?? data.plan_code ?? null;

      // -------------------------------------------------------------------
      // Campaign email credit pack: ₦2,000 for 1,000 extra campaign emails.
      //
      // Idempotent via grant_campaign_credits, which keys on the Paystack
      // reference — a replayed webhook adds nothing rather than granting free
      // credits.
      // -------------------------------------------------------------------
      if (userId && type === 'campaign_credits') {
        const { data: member } = await supabase
          .from('organization_members').select('organization_id')
          .eq('user_id', userId).limit(1).single();
        if (!member) throw new Error('User has no organization');

        const amount = data.amount; // kobo
        const PACK_PRICE_KOBO = 200000;  // ₦2,000
        const PACK_EMAILS = 1000;

        if (amount < PACK_PRICE_KOBO) {
          throw new Error(`Amount too low for campaign credit pack: ${amount} kobo`);
        }

        // Pay for more than one pack and you get more than one pack.
        const packs = Math.floor(amount / PACK_PRICE_KOBO);
        if (!reference) {
          throw new Error('Paystack payload has no reference — cannot guarantee idempotency');
        }

        const { data: grant, error: grantError } = await supabase.rpc('grant_campaign_credits', {
          p_org_id: member.organization_id,
          p_emails: packs * PACK_EMAILS,
          p_gateway: 'paystack',
          p_reference: String(reference),
          p_amount_minor: amount,
          p_currency: data.currency ?? 'NGN',
        });

        if (grantError) throw grantError;

        console.log(
          `Campaign credits for organization ${member.organization_id}: ` +
          `${JSON.stringify(grant)} (ref ${reference}).`
        );

        return new Response(JSON.stringify({ received: true, credits: grant }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }

      // If the charge was for a subscription
      if (type === 'saas_subscription' || subscriptionCode || customerCode) {
        let orgId: string | null = null;
        if (userId) {
          const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();
          orgId = member?.organization_id ?? null;
        }

        // Recurring charges are allowed to omit the original custom
        // metadata, so resolve the organization from the stored Paystack
        // subscription/customer identifiers when userId is unavailable.
        if (!orgId && subscriptionCode) {
          const { data: subscription } = await supabase
            .from('saas_subscriptions')
            .select('organization_id')
            .eq('provider', 'paystack')
            .eq('subscription_code', subscriptionCode)
            .maybeSingle();
          orgId = subscription?.organization_id ?? null;
        }
        if (!orgId && customerCode) {
          const { data: subscription } = await supabase
            .from('saas_subscriptions')
            .select('organization_id')
            .eq('provider', 'paystack')
            .eq('customer_code', customerCode)
            .maybeSingle();
          orgId = subscription?.organization_id ?? null;
        }
        if (!orgId) throw new Error('Could not resolve organization for SaaS subscription payment');

        const amount = data.amount; // in kobo
        
        // 3. Validate the server-side plan price and currency. The browser
        // amount is only a checkout hint and must never grant Pro by itself.
        if (amount < 350000 || String(data.currency || '').toUpperCase() !== 'NGN') {
            throw new Error(`Invalid amount or currency for PRO plan: ${amount} ${data.currency || '(missing)'}`);
        }

        if (!reference) {
          throw new Error('Paystack payload has no reference — cannot guarantee idempotency');
        }

        // The RPC inserts the reference under a unique constraint and extends
        // from the later of the current expiry or now. This makes webhook
        // retries harmless and preserves paid time on early renewals.
        const { data: entitlement, error: entitlementError } = await supabase.rpc(
          'record_saas_subscription_payment',
          {
            p_organization_id: orgId,
            p_provider_reference: String(reference),
            p_amount_minor: amount,
            p_currency: String(data.currency).toUpperCase(),
            p_event_type: event.event,
            p_customer_code: customerCode,
            p_subscription_code: subscriptionCode,
            p_plan_code: planCode,
            p_period_days: 30,
          }
        );

        if (entitlementError) {
          throw new Error(`Failed to record subscription payment: ${entitlementError.message}`);
        }

        if (entitlement?.duplicate) {
          console.log(`Paystack subscription webhook replay ignored (ref ${reference}).`);
        } else {
          console.log(`Organization ${orgId} successfully upgraded to PRO until ${entitlement?.expires_at}.`);

          // Send the welcome email only for a newly recorded payment. A
          // retried webhook must not send duplicate customer mail.
          const { data: profile } = await supabase
            .from('organizations')
            .select('email, name')
            .eq('id', orgId)
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
                      <li>Access premium document templates and layouts</li>
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
        }
      } else {
        throw new Error(`Ignored charge.success: Missing orgId or type is not saas_subscription (Found type: ${type})`);
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

      type = type || data.metadata?.type || '';

      // Failure/cancellation events may not contain the original user
      // metadata, so identifier-based lookup is preferred. The expiry is
      // intentionally left intact to provide the paid period as grace.
      const customerCode = data.customer?.customer_code ?? data.customer_code ?? null;
      const subscriptionCode =
        data.subscription_code ??
        data.subscription?.subscription_code ??
        null;

      if (type === 'saas_subscription' || subscriptionCode || customerCode) {
        const { error: statusError } = await supabase.rpc('update_saas_subscription_status', {
          p_provider: 'paystack',
          p_customer_code: customerCode,
          p_subscription_code: subscriptionCode,
          p_status: event.event === 'subscription.disable' || event.event === 'subscription.not_renew'
            ? 'CANCELLED'
            : 'PAST_DUE',
        });
        if (statusError) throw statusError;
        console.log(`Paystack subscription status updated to ${event.event}.`);
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
