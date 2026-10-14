import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { fromGatewayAmount, toMajorString } from "../_shared/money.ts";

/** Constant-time string comparison, so signature checks do not leak via timing. */
const secureEquals = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/**
 * Resolve the invoice's local_id from a Paystack charge payload.
 *
 * This used to read `data.metadata?.invoiceId` only. The checkout in
 * PublicInvoice.tsx sends the id inside `metadata.custom_fields` with
 * `variable_name: "invoice_id"`, which is the shape Paystack echoes back — so
 * `invoiceId` was always undefined and EVERY Paystack invoice payment returned
 * 400 and aborted. The customer was charged and the invoice never settled.
 *
 * Accepts all three shapes so old and new clients both work:
 *   metadata.invoiceId · metadata.invoice_id · metadata.custom_fields[]
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveInvoiceId = (metadata: any): string | null => {
  if (!metadata) return null;
  if (metadata.invoiceId) return String(metadata.invoiceId);
  if (metadata.invoice_id) return String(metadata.invoice_id);

  const fields = metadata.custom_fields;
  if (Array.isArray(fields)) {
    const match = fields.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => f?.variable_name === 'invoice_id' || f?.variable_name === 'invoiceId'
    );
    if (match?.value) return String(match.value);
  }
  return null;
};

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
      const invoiceId = resolveInvoiceId(data.metadata);

      if (!invoiceId) {
        console.error('Paystack webhook: could not resolve invoice id from metadata', JSON.stringify(data.metadata));
        return new Response('Missing invoice id in metadata', { status: 400 });
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

      // 2. Fetch the user's decrypted Paystack Secret Key
      const { data: secretKey, error: secretsError } = await supabase
        .rpc('get_merchant_secret', {
          p_org_id: invoice.organization_id,
          p_gateway: 'paystack'
        });

      if (secretsError || !secretKey) {
        throw new Error('Merchant secret key not configured');
      }

      // 3. Verify Paystack Signature
      const hash = createHmac('sha512', secretKey)
        .update(bodyText)
        .digest('hex');

      if (!secureEquals(hash, signature)) {
        console.error('Invalid Paystack signature for organization:', invoice.organization_id);
        return new Response('Invalid signature', { status: 401 });
      }

      // 4. Verify currency, then record the payment through the ledger.
      //
      // UNITS: Paystack reports minor units (kobo) and invoice.total is BIGINT
      // minor, so no division — fromGatewayAmount encodes that per gateway.
      //
      // Checkout charges the OUTSTANDING BALANCE, not the full total, so the
      // amount here may be a partial installment. record_payment_event
      // accumulates it and is replay-safe via UNIQUE (gateway, reference) —
      // comparing a single installment against the full total and overwriting
      // amount_paid previously meant an invoice paid in instalments could
      // never reach PAID.
      const paidAmountMinor = fromGatewayAmount(data.amount, 'paystack');
      const expectedCurrency = invoice.currency || 'NGN';

      if (data.currency !== expectedCurrency) {
        throw new Error(`Currency mismatch: Expected ${expectedCurrency}, got ${data.currency}`);
      }

      const reference = data.reference ?? data.id;
      if (!reference) {
        throw new Error('Paystack payload has no reference — cannot guarantee idempotency');
      }

      const { data: newStatus, error } = await supabase.rpc('record_payment_event', {
        p_org_id: invoice.organization_id,
        p_invoice_local_id: invoiceId,
        p_gateway: 'paystack',
        p_reference: String(reference),
        p_amount_minor: paidAmountMinor,
        p_currency: expectedCurrency
      });

      if (error) {
        console.error('Failed to record payment event:', error);
        throw error;
      }

      if (newStatus === 'DUPLICATE') {
        console.log(`Paystack webhook replay ignored for invoice ${invoiceId} (ref ${reference}).`);
      } else {
        console.log(
          `Invoice ${invoiceId} marked ${newStatus} via Paystack. ` +
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
