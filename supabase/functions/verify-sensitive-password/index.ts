import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ACTIONS = new Set(["withdraw", "pix_change"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, password } = await req.json().catch(() => ({}));
    if (!action || !VALID_ACTIONS.has(action)) {
      return new Response(JSON.stringify({ error: "Ação inválida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof password !== "string" || password.length < 1) {
      return new Response(JSON.stringify({ error: "Informe sua senha." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const passwordAuth = createClient(supabaseUrl, anonKey);
    const { error: passwordErr } = await passwordAuth.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (passwordErr) {
      return new Response(JSON.stringify({ error: "Senha incorreta." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = crypto.randomUUID();
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error: insertErr } = await supabase.from("sensitive_action_challenges").insert({
      user_id: user.id,
      action,
      code_hash: "password_confirmation",
      attempts: 0,
      expires_at: new Date().toISOString(),
      used_at: new Date().toISOString(),
      action_token: token,
      token_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    if (insertErr) {
      console.error("verify-sensitive-password insert failed:", insertErr);
      return new Response(JSON.stringify({ error: "Erro ao confirmar senha." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ action_token: token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-sensitive-password error:", e);
    return new Response(JSON.stringify({ error: "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});