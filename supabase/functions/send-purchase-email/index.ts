import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseEmailParams {
  buyer_name: string;
  buyer_email: string;
  product_title: string;
  product_type: string;
  product_id: string;
  file_url?: string | null;
}

async function sendPurchaseEmail(params: PurchaseEmailParams) {
  const { buyer_name, buyer_email, product_title, product_type, product_id, file_url } = params;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured, skipping email");
    return { sent: false, reason: "no_api_key" };
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const projectRef = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");

  // Build access link based on product type
  let accessLink: string;
  if (product_type === "course") {
    accessLink = `https://vitrapay.lovable.app/learn/${product_id}`;
  } else if (file_url) {
    accessLink = file_url;
  } else {
    accessLink = `https://vitrapay.lovable.app/library`;
  }

  const accessText = product_type === "course" ? "Acessar Curso" : "Baixar Produto";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#f5c842,#e6b800);padding:30px;text-align:center;">
          <h1 style="margin:0;color:#1a1a1a;font-size:24px;font-weight:bold;">🎉 Compra Confirmada!</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:30px;">
          <p style="font-size:16px;color:#333;margin:0 0 20px;">Olá <strong>${buyer_name}</strong>,</p>
          <p style="font-size:16px;color:#333;margin:0 0 20px;">Seu pagamento foi confirmado com sucesso!</p>
          <p style="font-size:16px;color:#333;margin:0 0 10px;">Produto: <strong>${product_title}</strong></p>
          <p style="font-size:16px;color:#333;margin:0 0 30px;">Você já pode acessar seu produto agora:</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${accessLink}" style="display:inline-block;background:#f5c842;color:#1a1a1a;font-weight:bold;font-size:16px;padding:14px 32px;border-radius:8px;text-decoration:none;">
              👉 ${accessText}
            </a>
          </td></tr></table>
          <p style="font-size:14px;color:#666;margin:30px 0 0;">Se tiver qualquer dúvida, responda este e-mail.</p>
          <p style="font-size:14px;color:#666;margin:20px 0 0;">Bom proveito 🚀</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#1a1a1a;padding:20px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">Equipe VitraPay</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    // Use Lovable AI to send email via supported model
    const response = await fetch(`https://taqseqektbipquvgfylc.supabase.co/functions/v1/send-purchase-email-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: buyer_email,
        subject: "🎉 Sua compra foi confirmada!",
        html: htmlBody,
      }),
    });

    console.log(`Email dispatch attempt for ${buyer_email}: status ${response.status}`);
    return { sent: true };
  } catch (err) {
    console.error("Email send error:", err);
    return { sent: false, reason: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const params: PurchaseEmailParams = await req.json();
    const result = await sendPurchaseEmail(params);
    return new Response(JSON.stringify(result), {
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

export { sendPurchaseEmail };
export type { PurchaseEmailParams };
