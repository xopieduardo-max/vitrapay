import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE_NAME = "VitraPay";
const SENDER_DOMAIN = "notify.vitrapay.com.br";
const FROM_DOMAIN = "vitrapay.com.br";
const LOGO_URL =
  "https://taqseqektbipquvgfylc.supabase.co/storage/v1/object/public/email-assets/logo-vitrapay.png";

const ACTION_LABEL: Record<string, { title: string; subject: string; description: string }> = {
  withdraw: {
    title: "Confirme seu saque",
    subject: "Código de confirmação - Saque VitraPay",
    description:
      "Recebemos uma solicitação de saque na sua conta VitraPay. Use o código abaixo para confirmar.",
  },
  pix_change: {
    title: "Confirme a troca da sua chave PIX",
    subject: "Código de confirmação - Troca de chave PIX",
    description:
      "Recebemos uma solicitação para alterar a chave PIX da sua conta VitraPay. Use o código abaixo para confirmar.",
  },
};

function buildOtpHtml(code: string, action: string): string {
  const meta = ACTION_LABEL[action];
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 30px 0;text-align:left;">
          <img src="${LOGO_URL}" alt="VitraPay" width="160" style="display:block;height:auto;" />
        </td></tr>
        <tr><td style="padding:30px;">
          <h1 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">${meta.title}</h1>
          <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px;">${meta.description}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:2px solid #f5c518;border-radius:12px;margin:0 0 24px;">
            <tr><td style="padding:24px;text-align:center;">
              <p style="font-size:13px;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px;">Seu código</p>
              <p style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;color:#0a0a0a;margin:0;letter-spacing:8px;">${code}</p>
              <p style="font-size:12px;color:#666;margin:12px 0 0;">Válido por 10 minutos</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 12px;">
            Se você não solicitou esta ação, ignore este e-mail e troque sua senha imediatamente em vitrapay.com.br/ajustes.
          </p>
          <p style="font-size:12px;color:#999;margin:24px 0 0;">${SITE_NAME} - Plataforma de pagamentos digitais</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();
    if (!action || !ACTION_LABEL[action]) {
      return new Response(JSON.stringify({ error: "invalid_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Gera código 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const { error: rpcErr } = await supabase.rpc("create_sensitive_challenge", {
      _user_id: user.id,
      _action: action,
      _code: code,
      _ip: ip,
      _ua: ua,
    });

    if (rpcErr) {
      const msg = rpcErr.message || "";
      if (msg.includes("rate_limited")) {
        return new Response(
          JSON.stringify({ error: "Muitos códigos solicitados. Tente novamente em 1 hora." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" } },
        );
      }
      console.error("create_sensitive_challenge error:", rpcErr);
      return new Response(JSON.stringify({ error: "internal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enfileira email
    const meta = ACTION_LABEL[action];
    const messageId = crypto.randomUUID();
    const html = buildOtpHtml(code, action);

    // Garante um unsubscribe_token para o destinatário (exigido pelo Lovable Emails)
    let unsubscribeToken: string | null = null;
    const { data: existingTok } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", user.email)
      .maybeSingle();
    if (existingTok?.token) {
      unsubscribeToken = existingTok.token;
    } else {
      const newToken = crypto.randomUUID().replace(/-/g, "");
      const { data: ins, error: insErr } = await supabase
        .from("email_unsubscribe_tokens")
        .insert({ email: user.email, token: newToken })
        .select("token")
        .single();
      if (insErr) console.error("unsubscribe_token insert failed:", insErr);
      unsubscribeToken = ins?.token || newToken;
    }

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "sensitive_otp",
      recipient_email: user.email,
      status: "pending",
      metadata: { action },
    });

    const { error: enqueueErr } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        idempotency_key: `otp-${messageId}`,
        to: user.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: meta.subject,
        html,
        text: `Seu código VitraPay: ${code} (válido por 10 minutos)`,
        purpose: "transactional",
        label: "sensitive_otp",
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueErr) {
      console.error("enqueue_email failed:", enqueueErr);
    }

    return new Response(
      JSON.stringify({ sent: true, email_masked: user.email.replace(/(.{2}).+(@.+)/, "$1***$2") }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("request-sensitive-otp error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
