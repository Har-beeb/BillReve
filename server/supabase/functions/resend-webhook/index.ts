import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Resend event webhook — feeds bounces and spam complaints into the
 * suppression list.
 *
 * Without this, every campaign re-sends to dead addresses and nothing ever
 * records a complaint. Both are direct inputs to sender reputation: Gmail and
 * Yahoo expect bulk senders to keep complaints under 0.3% and to stop mailing
 * hard bounces immediately. Previously neither was captured at all.
 *
 * Configure in the Resend dashboard for the events:
 *   email.bounced, email.complained, email.delivered, email.delivery_delayed
 * and set RESEND_WEBHOOK_SECRET to the signing secret it gives you.
 */

const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

/** Constant-time comparison so signature checks do not leak via timing. */
const secureEquals = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/**
 * Verify a Svix-style signature, which is what Resend uses.
 *
 * The signed payload is `{svix-id}.{svix-timestamp}.{raw body}`, HMAC-SHA256'd
 * with the base64-decoded secret (the part after the `whsec_` prefix). The
 * signature header may carry several space-separated versioned signatures, so
 * any `v1` match is accepted.
 */
const verifySignature = (
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null
): { ok: boolean; reason?: string } => {
  if (!WEBHOOK_SECRET) return { ok: false, reason: 'RESEND_WEBHOOK_SECRET is not configured' };
  if (!svixId || !svixTimestamp || !svixSignature) return { ok: false, reason: 'Missing Svix headers' };

  // Reject stale timestamps to blunt replay attacks.
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'Malformed timestamp' };
  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > 300) return { ok: false, reason: 'Timestamp outside tolerance' };

  const secretBase64 = WEBHOOK_SECRET.startsWith('whsec_')
    ? WEBHOOK_SECRET.slice('whsec_'.length)
    : WEBHOOK_SECRET;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretBase64, 'base64');
  } catch {
    return { ok: false, reason: 'Secret is not valid base64' };
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  const provided = svixSignature
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice('v1,'.length));

  if (provided.length === 0) return { ok: false, reason: 'No v1 signature present' };
  if (!provided.some((sig) => secureEquals(sig, expected))) {
    return { ok: false, reason: 'Signature mismatch' };
  }
  return { ok: true };
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  const verdict = verifySignature(
    rawBody,
    req.headers.get('svix-id'),
    req.headers.get('svix-timestamp'),
    req.headers.get('svix-signature')
  );

  if (!verdict.ok) {
    console.error('[resend-webhook] rejected:', verdict.reason);
    return new Response('Invalid signature', { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const type: string = event?.type ?? '';
    const data = event?.data ?? {};
    const providerId: string | undefined = data?.email_id;

    // Resolve the tenant from our own record of the send rather than trusting
    // anything in the payload.
    let recipientRow: { id: string; organization_id: string; email: string } | null = null;

    if (providerId) {
      const { data: row } = await supabase
        .from('campaign_recipients')
        .select('id, organization_id, email')
        .eq('provider_message_id', providerId)
        .maybeSingle();
      recipientRow = row ?? null;
    }

    if (!recipientRow) {
      // Transactional mail (invoices, reminders) also triggers these events and
      // has no campaign_recipients row. Nothing to suppress — acknowledge so
      // Resend does not retry forever.
      console.log(`[resend-webhook] ${type} for unknown message ${providerId ?? '(none)'} — ignoring.`);
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const detail = typeof data?.bounce?.message === 'string'
      ? data.bounce.message
      : typeof data?.reason === 'string' ? data.reason : null;

    if (type === 'email.bounced') {
      // Only HARD bounces should suppress. A soft bounce (full mailbox, temporary
      // server issue) is not a permanent failure and suppressing it would
      // needlessly lose a real contact.
      const bounceType: string = (data?.bounce?.type ?? data?.type ?? '').toString().toLowerCase();
      const isHard = bounceType.includes('permanent') || bounceType.includes('hard');

      await supabase.from('campaign_recipients')
        .update({ status: 'BOUNCED', error: detail })
        .eq('id', recipientRow.id);

      await supabase.rpc('bump_campaign_counter', {
        p_recipient_id: recipientRow.id,
        p_counter: 'bounced',
      });

      if (isHard) {
        await supabase.rpc('record_email_suppression', {
          p_org_id: recipientRow.organization_id,
          p_email: recipientRow.email,
          p_reason: 'BOUNCED',
          p_detail: detail,
        });
      }
    } else if (type === 'email.complained') {
      await supabase.from('campaign_recipients')
        .update({ status: 'COMPLAINED', error: detail })
        .eq('id', recipientRow.id);

      // A complaint always suppresses. Continuing to mail someone who marked
      // you as spam is the single fastest way to get a domain blocked.
      await supabase.rpc('record_email_suppression', {
        p_org_id: recipientRow.organization_id,
        p_email: recipientRow.email,
        p_reason: 'COMPLAINED',
        p_detail: detail,
      });

      await supabase.rpc('bump_campaign_counter', {
        p_recipient_id: recipientRow.id,
        p_counter: 'complained',
      });
    }

    return new Response(JSON.stringify({ received: true, matched: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[resend-webhook] error:', error);
    // Return 500 so Resend retries — losing a complaint event is worse than a
    // duplicate, and the suppression write is idempotent.
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
