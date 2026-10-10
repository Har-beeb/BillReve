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

      // 1. Fetch the invoice to find the user_id, total, and currency
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('organization_id, total, currency')
        .eq('local_id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        throw new Error(`Invoice not found: ${invoiceError?.message}`);
      }

      // 2. Fetch the user's decrypted Flutterwave Secret Hash
      const { data: secretKey, error: secretsError } = await supabase
        .rpc('get_merchant_secret', {
          p_org_id: invoice.organization_id,
          p_gateway: 'flutterwave'
        });

      if (secretsError || !secretKey) {
        throw new Error('Merchant secret key not configured');
      }

      // 3. Verify Signature
      if (signature !== secretKey) {
        console.error('Invalid Flutterwave signature for organization:', invoice.organization_id);
        return new Response('Invalid signature', { status: 401 });
      }

      // 4. Verify Amount & Currency, then update invoice
      const paidAmount = Number(data.amount);
      const expectedCurrency = invoice.currency || 'USD';
      
      if (data.currency !== expectedCurrency) {
        throw new Error(`Currency mismatch: Expected ${expectedCurrency}, got ${data.currency}`);
      }

      const newStatus = paidAmount >= invoice.total ? 'PAID' : 'PARTIAL';

      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: newStatus, 
          amount_paid: paidAmount
        })
        .eq('local_id', invoiceId);

      if (error) {
        console.error('Failed to update invoice in DB:', error);
        throw error;
      }
      
      console.log(`Invoice ${invoiceId} successfully marked as ${newStatus} via Flutterwave. Paid: ${paidAmount}, Total: ${invoice.total}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
