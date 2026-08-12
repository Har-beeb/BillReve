import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  let userIdForRateLimit = 'anonymous_user';

  if (!isPublicContact) {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    userIdForRateLimit = user.id;
  } else {
    // For anonymous contact requests, use the IP address for rate limiting
    userIdForRateLimit = req.headers.get('x-forwarded-for') || 'anonymous_ip';
    // We cannot easily use the check_and_log_rate_limit RPC for non-UUID strings since it expects UUID.
    // To prevent failure, we will skip the DB rate limit for anon or use a different mechanism.
    // For simplicity, we bypass the DB rate limit here. In production, we'd log to a different table or use Redis.
  }

  // Rate Limit for authenticated users (skip for anon contact since we don't have a UUID)
  if (!isPublicContact) {
    const { data: isAllowed, error: rateLimitError } = await supabaseClient.rpc('check_and_log_rate_limit', {
      p_user_id: userIdForRateLimit,
      p_endpoint: 'send-email',
      p_limit: 5,
      p_window_minutes: 1
    });

    if (rateLimitError) {
      console.error('Rate Limit Error:', rateLimitError);
    } else if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BillReve <hello@billreve.app>",
        to: Array.isArray(to) ? to : [to],
        reply_to: "hello@billreve.app",
        subject: subject || "Update from BillReve",
        html: html || "<p>Please see the attached document.</p>",
        attachments: attachments || [],
      }),
    });

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
