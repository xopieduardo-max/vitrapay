import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const deviceLabel = String(body.device_label || "Dispositivo desconhecido").slice(0, 120);
    const ip = body.ip ? String(body.ip).slice(0, 64) : "desconhecido";
    const when = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const email = user.email;
    if (!email) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const html = `
<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:28px;">
    <h2 style="margin:0 0 12px 0;color:#facc15;">Novo acesso à sua conta VitraPay</h2>
    <p style="margin:0 0 16px 0;color:#d4d4d4;">Detectamos um login a partir de um dispositivo que você ainda não havia usado.</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;color:#e5e5e5;">
      <tr><td style="padding:6px 0;color:#9ca3af;">Dispositivo</td><td style="padding:6px 0;text-align:right;">${deviceLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">IP</td><td style="padding:6px 0;text-align:right;">${ip}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Quando</td><td style="padding:6px 0;text-align:right;">${when}</td></tr>
    </table>
    <p style="margin:18px 0 0 0;color:#d4d4d4;">Se foi você, pode ignorar este e-mail. Se não reconhece este acesso, troque sua senha imediatamente em <a href="https://vitrapay.com.br/settings" style="color:#facc15;">Configurações</a>.</p>
  </div>
</body></html>`.trim();

    await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email,
        subject: "Novo acesso detectado na sua conta VitraPay",
        html,
        template_name: "new_device_alert",
        metadata: { user_id: user.id, ip, device_label: deviceLabel },
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
