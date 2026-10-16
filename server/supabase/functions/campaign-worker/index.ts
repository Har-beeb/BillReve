import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCampaignFrom,
  wrapCampaignHtml,
  unsubscribeHeaders,
  htmlToPlainText,
  campaignDomainIsSeparate,
} from "../_shared/email.ts";

/**
 * Campaign send worker.
 *
 * Replaces the previous approach, which passed EVERY recipient address into a
 * single `send-email` invoke from the browser. That was wrong in four ways:
 *   * Resend's batch endpoint caps at 100 messages per call, so a campaign to
 *     300 clients failed or silently truncated
 *   * one call meant one all-or-nothing result, with no record of who received
 *     anything
 *   * a long send could exceed the edge function wall clock mid-way, leaving no
 *     way to resume
 *   * suppressed addresses were never excluded, because no suppression list
 *     existed
 *
 * This drains `campaign_recipients` in batches, records per-recipient outcomes,
 * and is safe to call repeatedly — it only ever picks up PENDING rows, so a
 * crash or timeout simply resumes on the next run.
 *
 * Invoke from pg_cron on a short interval, and once immediately after queueing
 * so sends feel instant.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://billreve.app';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// Resend's batch endpoint hard limit.
const BATCH_SIZE = 100;
// How many batches to attempt per invocation, to stay inside the wall clock.
const MAX_BATCHES_PER_RUN = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecipientRow {
  id: string;
  email: string;
  unsubscribe_token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  /*
   * TWO CALLERS, DIFFERENT SCOPES.
   *
   * 1. The cron job presents CRON_SECRET and may drain every tenant's queue.
   * 2. A signed-in user may trigger a send, but ONLY for their own
   *    organization — `scopedOrgId` is applied to the campaigns query below.
   *
   * The second path exists because making this cron-only put three invisible
   * prerequisites (function deployed, CRON_SECRET set, two Vault secrets
   * created) between pressing Send and anything happening. When one was
   * missing, campaigns sat on QUEUED with no feedback. Now the client triggers
   * its own send immediately and cron is a retry backstop, so a cron
   * misconfiguration delays retries instead of blocking sending outright.
   */
  const authHeader = req.headers.get('Authorization');
  const isCron = Boolean(CRON_SECRET) && authHeader === `Bearer ${CRON_SECRET}`;
  let scopedOrgId: string | null = null;

  if (!isCron) {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!member?.organization_id) {
      return new Response(JSON.stringify({ error: 'No organization' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    scopedOrgId = member.organization_id;
  }

  if (!campaignDomainIsSeparate()) {
    // Not fatal, but worth shouting about in the logs: until CAMPAIGN_SENDER_ADDRESS
    // points at a verified subdomain, campaign complaints damage invoice delivery.
    console.warn(
      '[campaign-worker] CAMPAIGN_SENDER_ADDRESS is unset — campaigns are sending from the ' +
      'transactional domain, so their reputation is shared with invoice email.'
    );
  }

  const summary: Record<string, unknown>[] = [];

  try {
    let campaignQuery = supabase
      .from('campaigns')
      .select('id, organization_id, subject, title, preview_text, content_html, recipient_count')
      .in('status', ['QUEUED', 'SENDING'])
      .order('queued_at', { ascending: true })
      .limit(5);

    // A user-triggered run must never touch another tenant's campaigns.
    if (scopedOrgId) {
      campaignQuery = campaignQuery.eq('organization_id', scopedOrgId);
    }

    const { data: campaigns, error: campaignErr } = await campaignQuery;

    if (campaignErr) throw campaignErr;

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: 'Nothing to send.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const campaign of campaigns) {
      await supabase.from('campaigns')
        .update({ status: 'SENDING', updated_at: new Date().toISOString() })
        .eq('id', campaign.id);

      const { data: org } = await supabase
        .from('organizations')
        .select('name, address, email')
        .eq('id', campaign.organization_id)
        .maybeSingle();

      let sentThisCampaign = 0;
      let failedThisCampaign = 0;

      for (let batchNo = 0; batchNo < MAX_BATCHES_PER_RUN; batchNo++) {
        const { data: recipients, error: recipientErr } = await supabase
          .from('campaign_recipients')
          .select('id, email, unsubscribe_token')
          .eq('campaign_id', campaign.id)
          .eq('status', 'PENDING')
          .limit(BATCH_SIZE);

        if (recipientErr) throw recipientErr;
        if (!recipients || recipients.length === 0) break;

        // Re-check suppression at send time. Someone may have unsubscribed
        // between the campaign being queued and this batch running.
        const { data: suppressed } = await supabase
          .from('email_suppressions')
          .select('email')
          .eq('organization_id', campaign.organization_id)
          .in('email', recipients.map((r: RecipientRow) => r.email));

        const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email));
        const sendable = recipients.filter((r: RecipientRow) => !suppressedSet.has(r.email));
        const skipped = recipients.filter((r: RecipientRow) => suppressedSet.has(r.email));

        if (skipped.length > 0) {
          await supabase.from('campaign_recipients')
            .update({ status: 'SUPPRESSED', error: 'Recipient is on the suppression list' })
            .in('id', skipped.map((r: RecipientRow) => r.id));
        }

        if (sendable.length === 0) continue;

        const fromHeader = buildCampaignFrom(org?.name);

        const messages = sendable.map((r: RecipientRow) => {
          const unsubscribeUrl = `${FRONTEND_URL}/unsubscribe/${r.unsubscribe_token}`;
          const html = wrapCampaignHtml(campaign.content_html, {
            orgName: org?.name,
            orgAddress: org?.address,
            unsubscribeUrl,
          });
          return {
            from: fromHeader,
            to: [r.email],
            reply_to: org?.email || undefined,
            subject: campaign.subject,
            html,
            // An HTML-only bulk message is a strong spam signal.
            text: htmlToPlainText(html),
            headers: unsubscribeHeaders(unsubscribeUrl),
          };
        });

        let res: Response;
        try {
          res = await fetch('https://api.resend.com/emails/batch', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
          });
        } catch (networkErr) {
          // Leave the rows PENDING so the next run retries them.
          console.error('[campaign-worker] network failure, batch left pending:', networkErr);
          break;
        }

        const body = await res.json().catch(() => null);

        if (!res.ok) {
          const message = typeof body?.message === 'string' ? body.message : `HTTP ${res.status}`;
          console.error('[campaign-worker] Resend rejected batch:', message);

          await supabase.from('campaign_recipients')
            .update({
              status: 'FAILED',
              error: message.slice(0, 500),
              attempts: 1,
            })
            .in('id', sendable.map((r: RecipientRow) => r.id));

          failedThisCampaign += sendable.length;
          // A 4xx will fail identically on retry; stop this campaign.
          if (res.status >= 400 && res.status < 500) break;
          continue;
        }

        // Resend returns ids in request order.
        const ids: string[] = Array.isArray(body?.data)
          ? body.data.map((d: { id?: string }) => d?.id ?? '')
          : [];

        const nowIso = new Date().toISOString();
        for (let i = 0; i < sendable.length; i++) {
          await supabase.from('campaign_recipients')
            .update({
              status: 'SENT',
              provider_message_id: ids[i] || null,
              sent_at: nowIso,
              attempts: 1,
            })
            .eq('id', sendable[i].id);
        }
        sentThisCampaign += sendable.length;
      }

      // Recount from the source of truth rather than trusting the loop.
      const { count: remaining } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'PENDING');

      const { count: sentTotal } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'SENT');

      const { count: failedTotal } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', ['FAILED', 'SUPPRESSED']);

      const isDone = (remaining ?? 0) === 0;
      const finalStatus = !isDone
        ? 'SENDING'
        : (sentTotal ?? 0) === 0
          ? 'FAILED'
          : (failedTotal ?? 0) > 0 ? 'PARTIAL' : 'SENT';

      await supabase.from('campaigns')
        .update({
          status: finalStatus,
          sent_count: sentTotal ?? 0,
          failed_count: failedTotal ?? 0,
          sent_at: isDone ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id);

      summary.push({
        campaignId: campaign.id,
        status: finalStatus,
        sentThisRun: sentThisCampaign,
        failedThisRun: failedThisCampaign,
        remaining: remaining ?? 0,
      });
    }

    return new Response(JSON.stringify({ processed: summary.length, summary }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[campaign-worker] fatal:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
