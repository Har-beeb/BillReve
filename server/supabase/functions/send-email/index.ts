import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFrom, wrapEmailHtml } from "../_shared/email.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { to, subject, html, attachments } = payload;
  const authHeader = req.headers.get('Authorization');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const isPublicContact = to === 'support@billreve.app' || (Array.isArray(to) && to.length === 1 && to[0] === 'support@billreve.app');
  const isAnonRequest = !authHeader || authHeader === `Bearer ${anonKey}`;

  if (!isPublicContact && isAnonRequest) {
    return new Response(JSON.stringify({ error: 'Unauthorized or missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    anonKey ?? '',
    { global: { headers: { Authorization: authHeader || `Bearer ${anonKey}` } } }
  );

  let userIdForRateLimit: string | null = null;
  let organizationName: string | null = null;
  let organizationEmail: string | null = null;

  if (!isPublicContact) {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    userIdForRateLimit = user.id;

    const recipients = Array.isArray(to) ? to : [to];
    const normalizedRecipients = recipients
      .filter((recipient): recipient is string => typeof recipient === 'string')
      .map((recipient) => recipient.trim().toLowerCase());

    if (
      recipients.length === 0 ||
      recipients.length > 10 ||
      normalizedRecipients.length !== recipients.length ||
      normalizedRecipients.some((recipient) => !recipient)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid recipient list' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: memberships, error: membershipError } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

    if (membershipError || !memberships?.length) {
      console.error('Could not resolve sender organization:', membershipError);
      return new Response(JSON.stringify({ error: 'Unable to resolve sender organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const organizationIds = memberships.map((membership) => membership.organization_id);
    const { data: clients, error: clientsError } = await supabaseClient
      .from('clients')
      .select('email, organization_id')
      .in('organization_id', organizationIds)
      .in('email', normalizedRecipients);

    if (clientsError) {
      console.error('Could not validate email recipients:', clientsError);
      return new Response(JSON.stringify({ error: 'Unable to validate recipients' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allowedRecipients = new Set(
      (clients || [])
        .map((client) => client.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email))
    );

    if (normalizedRecipients.some((recipient) => !allowedRecipients.has(recipient))) {
      return new Response(JSON.stringify({ error: 'Recipients must belong to your organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const recipientOrganizationIds = new Set((clients || []).map((client) => client.organization_id));
    if (recipientOrganizationIds.size !== 1) {
      return new Response(JSON.stringify({ error: 'All recipients must belong to the same organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const organizationId = clients?.[0]?.organization_id;
    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'Unable to resolve sender organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: organization, error: organizationError } = await supabaseClient
      .from('organizations')
      .select('name, email')
      .eq('id', organizationId)
      .maybeSingle();

    if (organizationError) {
      console.error('Could not load sender organization:', organizationError);
      return new Response(JSON.stringify({ error: 'Unable to load sender organization' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    organizationName = organization?.name || null;
    organizationEmail = organization?.email || null;
  } else {
    // Anonymous requests are limited to the support inbox above.
  }

  // Fail closed if rate-limit validation is unavailable; otherwise a database
  // outage would turn this endpoint into an unrestricted email relay.
  if (userIdForRateLimit) {
    const { data: isAllowed, error: rateLimitError } = await supabaseClient.rpc('check_and_log_rate_limit', {
      p_user_id: userIdForRateLimit,
      p_endpoint: 'send-email',
      p_limit: 5,
      p_window_minutes: 1
    });

    if (rateLimitError) {
      console.error('Rate Limit Error:', rateLimitError);
      return new Response(JSON.stringify({ error: 'Unable to validate sending limits' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const recipients = Array.isArray(to) ? to : [to];

    // The organization's own name goes in the From display name, and every
    // body gets the "Powered by BillReve" footer. Both are centralised in
    // _shared/email.ts so a new send path cannot omit them. buildFrom also
    // strips header-injection characters from the merchant-supplied name.
    const fromHeader = isPublicContact
      ? buildFrom()
      : buildFrom(organizationName);
    const bodyHtml = wrapEmailHtml(html, { orgName: organizationName });
    const replyToHeader = isPublicContact
      ? "support@billreve.app"
      : organizationEmail || "support@billreve.app";

    let res;
    if (recipients.length === 1) {
      // Use the standard endpoint for single emails, which safely supports all attachments
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromHeader,
          to: recipients,
          reply_to: replyToHeader,
          subject: subject || "Update from BillReve",
          html: bodyHtml,
          attachments: attachments || [],
        }),
      });
    } else {
      // Use the batch endpoint for multiple recipients
      res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(recipients.map(recipient => ({
          from: fromHeader,
          to: [recipient],
          reply_to: replyToHeader,
          subject: subject || "Update from BillReve",
          html: bodyHtml,
          attachments: attachments || [],
        }))),
      });
    }

    const data = await res.json();

    if (res.ok) {
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
