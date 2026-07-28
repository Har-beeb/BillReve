import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const signature = req.headers.get('verif-hash');
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const payload = await req.json();

    // Verify it's a successful transaction event
    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const data = payload.data;
      const invoiceId = data.tx_ref; // We pass the invoice ID as tx_ref

      if (!invoiceId) {
        return new Response('Missing tx_ref', { status: 400 });
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

      // 2. Fetch the user's Flutterwave Secret Hash
      const { data: secrets, error: secretsError } = await supabase
        .from('user_secrets')
        .select('flutterwave_secret_key')
        .eq('user_id', invoice.user_id)
        .single();

      if (secretsError || !secrets || !secrets.flutterwave_secret_key) {
        throw new Error('Merchant secret key not configured');
      }

      // 3. Verify Signature
      if (signature !== secrets.flutterwave_secret_key) {
        console.error('Invalid Flutterwave signature for user:', invoice.user_id);
        return new Response('Invalid signature', { status: 401 });
      }

      // 4. Update invoice
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'PAID', 
          amount_paid: data.amount
        })
        .eq('local_id', invoiceId);

      if (error) {
        console.error('Failed to update invoice in DB:', error);
        throw error;
      }
      
      console.log(`Invoice ${invoiceId} successfully marked as PAID via Flutterwave.`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
