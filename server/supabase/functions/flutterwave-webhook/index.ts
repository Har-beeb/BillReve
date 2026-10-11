import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { fromGatewayAmount, toMajorString } from "../_shared/money.ts";

/** Constant-time string comparison, so signature checks do not leak via timing. */
const secureEquals = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

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
      if (!secureEquals(signature, secretKey)) {
        console.error('Invalid Flutterwave signature for organization:', invoice.organization_id);
        return new Response('Invalid signature', { status: 401 });
      }

      // 4. Verify Amount & Currency, then update invoice.
      //
      // UNITS: invoice.total is BIGINT MINOR units (kobo/cents) as of migration
      // 20261009010000, but Flutterwave reports `data.amount` in MAJOR units.
      // fromGatewayAmount converts so both sides of the comparison are minor.
      //
      // TODO(hardening): Flutterwave's docs recommend re-fetching the
      // transaction from GET /v3/transactions/:id/verify rather than trusting
      // the webhook body. That call needs the merchant's Flutterwave API secret
      // key, which is distinct from the verif-hash stored here, so it needs a
      // separate credential in user_secrets before it can be implemented.
      const paidAmountMinor = fromGatewayAmount(data.amount, 'flutterwave');
      const expectedCurrency = invoice.currency || 'USD';

      if (data.currency !== expectedCurrency) {
        throw new Error(`Currency mismatch: Expected ${expectedCurrency}, got ${data.currency}`);
      }

      const newStatus = paidAmountMinor >= invoice.total ? 'PAID' : 'PARTIAL';

      const { error } = await supabase
        .from('invoices')
        .update({
          status: newStatus,
          amount_paid: paidAmountMinor
        })
        .eq('local_id', invoiceId);

      if (error) {
        console.error('Failed to update invoice in DB:', error);
        throw error;
      }

      console.log(
        `Invoice ${invoiceId} marked ${newStatus} via Flutterwave. ` +
        `Paid ${expectedCurrency} ${toMajorString(paidAmountMinor)} of ${toMajorString(invoice.total)} ` +
        `(minor: ${paidAmountMinor}/${invoice.total}).`
      );
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
