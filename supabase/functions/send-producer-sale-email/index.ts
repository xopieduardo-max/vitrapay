import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "VitraPay";
const SENDER_DOMAIN = "notify.vitrapay.com.br";
const FROM_DOMAIN = "vitrapay.com.br";
const LOGO_URL = "https://taqseqektbipquvgfylc.supabase.co/storage/v1/object/public/email-assets/logo-vitrapay.png";

interface ProducerSaleEmailParams {
  producer_id: string;
  product_title: string;
  buyer_name: string;
  amount: number; // em centavos
  payment_method: "pix" | "credit_card";
}

function buildProducerSaleEmailHtml(params: ProducerSaleEmailParams): string {
  const { product_title, buyer_name, amount, payment_method } = params;
  const amountFormatted = `R$ ${(amount / 100).toFixed(2).replace(".", ",")}`;
  const paymentLabel = payment_method === "pix" ? "Pix" : "Cartão de Crédito";
  const dashboardLink = "https://www.vitrapay.com.br/sales";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">

        <!-- Logo -->
        <tr><td style="padding:28px 30px 0;text-align:left;">
          <img src="${LOGO_URL}" alt="VitraPay" width="140" height="40" style="display:block;" />
        </td></tr>

        <!-- Header -->
        <tr><td style="background:#f5c518;padding:32px 30px;text-align:center;">
          <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:24px;font-weight:bold;">Nova Venda Confirmada!</h1>
          <p style="margin:0;color:#333;font-size:15px;">Voc&#234; acaba de receber um pagamento</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px;">
          <p style="font-size:16px;color:#333;margin:0 0 24px;line-height:1.6;">
            Parab&#233;ns! Uma nova venda foi confirmada na sua conta.
          </p>

          <!-- Sale Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin:0 0 24px;">
            <tr><td style="padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;">
                    <p style="font-size:13px;color:#888;margin:0 0 2px;">Produto</p>
                    <p style="font-size:16px;color:#1a1a1a;margin:0;font-weight:bold;">${product_title}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 6px;border-top:1px solid #eee;">
                    <p style="font-size:13px;color:#888;margin:0 0 2px;">Comprador</p>
                    <p style="font-size:15px;color:#1a1a1a;margin:0;">${buyer_name}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 6px;border-top:1px solid #eee;">
                    <p style="font-size:13px;color:#888;margin:0 0 2px;">Valor recebido</p>
                    <p style="font-size:22px;color:#1a8a1a;margin:0;font-weight:bold;">${amountFormatted}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 6px;border-top:1px solid #eee;">
                    <p style="font-size:13px;color:#888;margin:0 0 2px;">Forma de pagamento</p>
                    <p style="font-size:15px;color:#1a1a1a;margin:0;">${paymentLabel}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${dashboardLink}" style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:bold;font-size:16px;padding:16px 36px;border-radius:12px;text-decoration:none;">
              Ver Minhas Vendas
            </a>
          </td></tr></table>

          <p style="font-size:14px;color:#666;margin:28px 0 0;line-height:1.5;">
            Acompanhe todas as suas vendas e financeiro no painel da VitraPay.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f5f5f5;padding:24px 30px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">Equipe VitraPay &middot; vitrapay.com.br</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPlainText(params: ProducerSaleEmailParams): string {
  const { product_title, buyer_name, amount, payment_method } = params;
  const amountFormatted = `R$ ${(amount / 100).toFixed(2).replace(".", ",")}`;
  const paymentLabel = payment_method === "pix" ? "Pix" : "Cartão de Crédito";
  return `Nova venda confirmada!\n\nProduto: ${product_title}\nComprador: ${buyer_name}\nValor: ${amountFormatted}\nPagamento: ${paymentLabel}\n\nAcesse seu painel: https://www.vitrapay.com.br/sales\n\nEquipe VitraPay`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const params: ProducerSaleEmailParams = await req.json();
    const { producer_id, amount, payment_method } = params;

    if (!producer_id) {
      return new Response(JSON.stringify({ sent: false, reason: "missing_producer_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get producer email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(producer_id);
    if (userError || !userData?.user?.email) {
      console.error("Producer not found:", producer_id, userError);
      return new Response(JSON.stringify({ sent: false, reason: "producer_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const producerEmail = userData.user.email;
    const html = buildProducerSaleEmailHtml(params);
    const text = buildPlainText(params);
    const messageId = crypto.randomUUID();
    const amountFormatted = `R$ ${(amount / 100).toFixed(2).replace(".", ",")}`;
    const paymentLabel = payment_method === "pix" ? "Pix" : "Cartão";

    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        idempotency_key: `producer-sale-${messageId}`,
        to: producerEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `Nova venda! ${amountFormatted} via ${paymentLabel}`,
        html,
        text,
        purpose: "transactional",
        label: "producer_sale_notification",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue producer sale email:", enqueueError);
      return new Response(JSON.stringify({ sent: false, reason: "enqueue_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Producer sale email enqueued:", producerEmail, messageId);
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
