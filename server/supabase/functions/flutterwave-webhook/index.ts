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

      // 4. Verify currency, then record the payment through the ledger.
      //
      // UNITS: Flutterwave reports MAJOR units while invoice.total is BIGINT
      // minor, so fromGatewayAmount converts.
      //
      // Checkout charges the OUTSTANDING BALANCE, so this may be a partial
      // installment. record_payment_event accumulates it and is replay-safe.
      // Comparing one installment against the full total and overwriting
      // amount_paid previously meant an invoice paid in instalments could never
      // reach PAID, and only the last installment was recorded.
      //
      // IMPORTANT: the idempotency key is flw_ref / transaction id, NOT tx_ref.
      // tx_ref is set to the invoice local_id and therefore repeats across
      // installments, which would make a second genuine payment look like a
      // duplicate and be silently dropped.
      //
      // TODO(hardening): Flutterwave recommend re-fetching from
      // GET /v3/transactions/:id/verify rather than trusting this payload. That
      // needs the merchant's Flutterwave API secret, a different credential
      // from the verif-hash stored here.
      const paidAmountMinor = fromGatewayAmount(data.amount, 'flutterwave');
      const expectedCurrency = invoice.currency || 'USD';

      if (data.currency !== expectedCurrency) {
        throw new Error(`Currency mismatch: Expected ${expectedCurrency}, got ${data.currency}`);
      }

      const reference = data.flw_ref ?? data.id;
      if (!reference) {
        throw new Error('Flutterwave payload has no flw_ref or id — cannot guarantee idempotency');
      }

      const { data: newStatus, error } = await supabase.rpc('record_payment_event', {
        p_org_id: invoice.organization_id,
        p_invoice_local_id: invoiceId,
        p_gateway: 'flutterwave',
        p_reference: String(reference),
        p_amount_minor: paidAmountMinor,
        p_currency: expectedCurrency
      });

      if (error) {
        console.error('Failed to record payment event:', error);
        throw error;
      }

      if (newStatus === 'DUPLICATE') {
        console.log(`Flutterwave webhook replay ignored for invoice ${invoiceId} (ref ${reference}).`);
      } else {
        console.log(
          `Invoice ${invoiceId} marked ${newStatus} via Flutterwave. ` +
          `Captured ${expectedCurrency} ${toMajorString(paidAmountMinor)} ` +
          `against a total of ${toMajorString(invoice.total)} (ref ${reference}).`
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});
