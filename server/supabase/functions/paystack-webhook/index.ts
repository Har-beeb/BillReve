import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

serve(async (req) => {
  try {
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const bodyText = await req.text();
    const event = JSON.parse(bodyText);

    // Only handle successful payments for now
    if (event.event === 'charge.success') {
      const data = event.data;
      const invoiceId = data.metadata?.invoiceId;

      if (!invoiceId) {
        return new Response('Missing invoiceId in metadata', { status: 400 });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Fetch the invoice to find the user_id
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('user_id')
        .eq('local_id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        throw new Error(`Invoice not found: ${invoiceError?.message}`);
      }

      // 2. Fetch the user's Paystack Secret Key
      const { data: secrets, error: secretsError } = await supabase
        .from('user_secrets')
        .select('paystack_secret_key')
        .eq('user_id', invoice.user_id)
        .single();

      if (secretsError || !secrets || !secrets.paystack_secret_key) {
        throw new Error('Merchant secret key not configured');
      }

      // 3. Verify Paystack Signature
      const hash = createHmac('sha512', secrets.paystack_secret_key)
        .update(bodyText)
        .digest('hex');

      if (hash !== signature) {
        console.error('Invalid Paystack signature for user:', invoice.user_id);
        return new Response('Invalid signature', { status: 401 });
      }

      // 4. Signature valid, update invoice
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'PAID', 
          amount_paid: data.amount / 100 // Paystack amount is in kobo/cents
        })
        .eq('local_id', invoiceId);

      if (error) {
        console.error('Failed to update invoice in DB:', error);
        throw error;
      }
      
      console.log(`Invoice ${invoiceId} successfully marked as PAID via Paystack.`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
