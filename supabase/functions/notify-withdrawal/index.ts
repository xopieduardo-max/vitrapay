import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "VitraPay";
const SENDER_DOMAIN = "notify.vitrapay.com.br";
const FROM_DOMAIN = "vitrapay.com.br";
const LOGO_URL = "https://taqseqektbipquvgfylc.supabase.co/storage/v1/object/public/email-assets/logo-vitrapay.png";

interface WithdrawalNotifyParams {
  user_id: string;
  amount: number; // in cents
  transfer_id?: string;
}

function buildWithdrawalEmailHtml(displayName: string, amount: number, transferId?: string): string {
  const valueFormatted = `R$ ${(amount / 100).toFixed(2)}`;
  const transferInfo = transferId
    ? `<p style="font-size:13px;color:#888;margin:8px 0 0;">ID da transferência: <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;">${transferId.substring(0, 16)}…</code></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Logo -->
        <tr><td style="padding:28px 30px 0;text-align:left;">
          <img src="${LOGO_URL}" alt="VitraPay" width="140" style="display:block;" />
        </td></tr>

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,hsl(48,96%,53%),hsl(43,90%,45%));padding:32px 30px;text-align:center;">
          <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:26px;font-weight:bold;">💸 Saque Enviado!</h1>
          <p style="margin:0;color:#333;font-size:15px;">Seu PIX foi processado com sucesso</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 30px;">
          <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.6;">
            Olá <strong>${displayName}</strong>,
          </p>
          <p style="font-size:16px;color:#333;margin:0 0 24px;line-height:1.6;">
            Seu saque foi processado e o valor já está a caminho da sua conta! 🎉
          </p>

          <!-- Amount Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin:0 0 24px;">
            <tr><td style="padding:20px;">
              <p style="font-size:13px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Valor do saque</p>
              <p style="font-size:28px;color:#0a0a0a;margin:0;font-weight:bold;">${valueFormatted}</p>
              ${transferInfo}
            </td></tr>
          </table>

          <p style="font-size:14px;color:#888;margin:0 0 8px;line-height:1.5;">
            O PIX deve cair na sua conta em instantes.
          </p>
          <p style="font-size:14px;color:#888;margin:0;line-height:1.5;">
            Em caso de dúvidas, responda este e-mail.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0a0a0a;padding:24px 30px;text-align:center;">
          <p style="margin:0;color:#666;font-size:12px;">Equipe VitraPay · vitrapay.com.br</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, amount, transfer_id }: WithdrawalNotifyParams = await req.json();

    if (!user_id || !amount) {
      return new Response(JSON.stringify({ error: "user_id and amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user profile and email
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, user_id")
      .eq("user_id", user_id)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
    const userEmail = authUser?.user?.email;
    const displayName = profile?.display_name || "Produtor";

    const results: any = { push_sent: false, email_queued: false };

    // ── 1. Send Push Notification ──
    try {
      const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer_id: user_id,
          title: "💸 Saque enviado!",
          body: `Seu saque de R$ ${(amount / 100).toFixed(2)} via PIX foi processado.`,
          url: "/finance",
        }),
      });
      const pushData = await pushRes.json();
      results.push_sent = pushData.sent > 0;
      console.log("Push result:", JSON.stringify(pushData));
    } catch (e) {
      console.error("Push notification error:", e);
    }

    // ── 2. Send Email Notification ──
    if (userEmail) {
      try {
        const html = buildWithdrawalEmailHtml(displayName, amount, transfer_id);
        const messageId = crypto.randomUUID();

        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "withdrawal_paid",
          recipient_email: userEmail,
          status: "pending",
        });

        const { error: enqueueError } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: userEmail,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: "💸 Seu saque foi processado!",
            html,
            text: `Olá ${displayName},\n\nSeu saque de R$ ${(amount / 100).toFixed(2)} via PIX foi processado com sucesso!\n\n${transfer_id ? `ID da transferência: ${transfer_id}\n\n` : ""}O valor deve cair na sua conta em instantes.\n\nEquipe VitraPay`,
            purpose: "transactional",
            label: "withdrawal_paid",
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          console.error("Failed to enqueue withdrawal email:", enqueueError);
        } else {
          results.email_queued = true;
          console.log("Withdrawal email enqueued:", userEmail, messageId);
        }
      } catch (e) {
        console.error("Email notification error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-withdrawal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
