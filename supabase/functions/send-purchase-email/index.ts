import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "VitraPay";
const SENDER_DOMAIN = "notify.vitrapay.com.br";
const FROM_DOMAIN = "vitrapay.com.br";
const LOGO_URL = "https://taqseqektbipquvgfylc.supabase.co/storage/v1/object/public/email-assets/logo-vitrapay.png";
const CELEBRATION_IMG = "https://taqseqektbipquvgfylc.supabase.co/storage/v1/object/public/email-assets/email-celebration-woman.png";

interface PurchaseEmailParams {
  buyer_name: string;
  buyer_email: string;
  product_title: string;
  product_type: string;
  product_id: string;
  file_url?: string | null;
}

function buildPurchaseEmailHtml(params: PurchaseEmailParams): string {
  const { buyer_name, product_title, product_type, product_id, file_url } = params;

  let accessLink: string;
  if (product_type === "course") {
    accessLink = `https://vitrapay.lovable.app/learn/${product_id}`;
  } else if (file_url) {
    accessLink = file_url;
  } else {
    accessLink = `https://vitrapay.lovable.app/library`;
  }

  const accessText = product_type === "course" ? "Acessar Curso" : "Baixar Produto";

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

        <!-- Header with gradient -->
        <tr><td style="background:linear-gradient(135deg,hsl(48,96%,53%),hsl(43,90%,45%));padding:32px 30px;text-align:center;">
          <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:26px;font-weight:bold;">🎉 Compra Confirmada!</h1>
          <p style="margin:0;color:#333;font-size:15px;">Seu pagamento foi processado com sucesso</p>
        </td></tr>

        <!-- Celebration Image -->
        <tr><td style="text-align:center;padding:24px 30px 0;">
          <img src="${CELEBRATION_IMG}" alt="Parabéns pela compra!" width="280" style="display:block;margin:0 auto;border-radius:12px;" />
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 30px 30px;">
          <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.6;">
            Olá <strong>${buyer_name}</strong>,
          </p>
          <p style="font-size:16px;color:#333;margin:0 0 16px;line-height:1.6;">
            Seu pagamento foi confirmado com sucesso! 🚀
          </p>

          <!-- Product Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin:0 0 24px;">
            <tr><td style="padding:16px 20px;">
              <p style="font-size:13px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Produto</p>
              <p style="font-size:18px;color:#0a0a0a;margin:0;font-weight:bold;">${product_title}</p>
            </td></tr>
          </table>

          <p style="font-size:16px;color:#333;margin:0 0 24px;line-height:1.6;">
            Você já pode acessar seu produto agora:
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${accessLink}" style="display:inline-block;background:hsl(48,96%,53%);color:#1a1a1a;font-weight:bold;font-size:16px;padding:16px 36px;border-radius:12px;text-decoration:none;">
              👉 ${accessText}
            </a>
          </td></tr></table>

          <p style="font-size:14px;color:#888;margin:28px 0 0;line-height:1.5;">
            Se tiver qualquer dúvida, responda este e-mail.
          </p>
          <p style="font-size:14px;color:#888;margin:12px 0 0;line-height:1.5;">
            Bom proveito! 🚀
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

function buildPlainText(params: PurchaseEmailParams): string {
  const { buyer_name, product_title, product_type, product_id, file_url } = params;
  let accessLink: string;
  if (product_type === "course") {
    accessLink = `https://vitrapay.lovable.app/learn/${product_id}`;
  } else if (file_url) {
    accessLink = file_url;
  } else {
    accessLink = `https://vitrapay.lovable.app/library`;
  }
  return `Olá ${buyer_name},\n\nSeu pagamento foi confirmado com sucesso!\n\nProduto: ${product_title}\n\nAcesse seu produto: ${accessLink}\n\nBom proveito!\nEquipe VitraPay`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const params: PurchaseEmailParams = await req.json();
    const { buyer_email } = params;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const html = buildPurchaseEmailHtml(params);
    const text = buildPlainText(params);
    const messageId = crypto.randomUUID();

    // Log pending
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "purchase_confirmation",
      recipient_email: buyer_email,
      status: "pending",
    });

    // Enqueue to transactional queue for async processing
    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        idempotency_key: `purchase-confirm-${messageId}`,
        to: buyer_email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: "🎉 Sua compra foi confirmada!",
        html,
        text,
        purpose: "transactional",
        label: "purchase_confirmation",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue purchase email:", enqueueError);
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "purchase_confirmation",
        recipient_email: buyer_email,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      return new Response(JSON.stringify({ sent: false, reason: "enqueue_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Purchase email enqueued:", buyer_email, messageId);

    return new Response(JSON.stringify({ sent: true, queued: true, message_id: messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
