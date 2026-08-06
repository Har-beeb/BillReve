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

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    // Auth verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate Limiting (using Service Role to bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: rateLimit } = await supabaseAdmin
      .from('rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const isPro = (await supabaseAdmin.from('profiles').select('is_pro').eq('id', user.id).single()).data?.is_pro;
    const LIMIT = isPro ? 100 : 10; // 100/day for Pro, 10/day for Free

    if (rateLimit) {
      const now = new Date();
      const resetAt = new Date(rateLimit.reset_at);

      if (now > resetAt) {
        // Reset counts if past reset_at
        await supabaseAdmin.from('rate_limits').update({
          email_count: 1,
          reset_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
        }).eq('user_id', user.id);
      } else {
        if (rateLimit.email_count >= LIMIT) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait until tomorrow or upgrade to Pro.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Increment
        await supabaseAdmin.from('rate_limits').update({
          email_count: rateLimit.email_count + 1
        }).eq('user_id', user.id);
      }
    }

    const payload = await req.json();
    const { to, subject, html, attachments } = payload;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "BillReve <hello@billreve.app>",
        to: Array.isArray(to) ? to : [to],
        reply_to: "support@billreve.app",
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
