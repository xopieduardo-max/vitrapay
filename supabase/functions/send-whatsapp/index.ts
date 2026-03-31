import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WHATSAPP_ENGINE_URL =
  "https://whatsapp-saas-engine-production.up.railway.app";
const WHATSAPP_SESSION_ID = "1cd24a0e-6647-4a11-a8d5-f775264b39bf";

function formatPhoneJid(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");
  // Add country code if missing
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `${withCountry}@s.whatsapp.net`;
}

function buildRecoveryMessage(
  buyerName: string,
  productTitle: string,
  checkoutLink: string,
  isSecond: boolean
): string {
  const name = buyerName || "Cliente";
  if (isSecond) {
    return `⏰ *Última chance, ${name}!*\n\nO link de pagamento do produto *${productTitle}* vai expirar em breve.\n\nFinalize agora antes que expire:\n${checkoutLink}\n\nSe já pagou, desconsidere esta mensagem.\n\n_Equipe VitraPay_`;
  }
  return `🛒 *Olá, ${name}!*\n\nNotamos que você iniciou a compra do produto *${productTitle}*, mas o pagamento ainda não foi confirmado.\n\nFinalize sua compra aqui:\n${checkoutLink}\n\nSe já pagou, desconsidere esta mensagem.\n\n_Equipe VitraPay_`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WHATSAPP_JWT = Deno.env.get("WHATSAPP_JWT_TOKEN");
    if (!WHATSAPP_JWT) {
      throw new Error("WHATSAPP_JWT_TOKEN not configured");
    }

    const body = await req.json();
    const {
      phone,
      buyer_name,
      product_title,
      checkout_link,
      is_second,
      custom_message,
    } = body;

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jid = formatPhoneJid(phone);
    const message =
      custom_message ||
      buildRecoveryMessage(
        buyer_name || "",
        product_title || "Produto",
        checkout_link || "https://www.vitrapay.com.br",
        is_second || false
      );

    console.log(`Sending WhatsApp to ${jid}: ${message.substring(0, 50)}...`);

    const res = await fetch(
      `${WHATSAPP_ENGINE_URL}/${WHATSAPP_SESSION_ID}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_JWT}`,
        },
        body: JSON.stringify({
          chat_id: jid,
          text: message,
        }),
      }
    );

    const responseText = await res.text();
    console.log(`WhatsApp API response [${res.status}]: ${responseText}`);

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "WhatsApp API error",
          status: res.status,
          details: responseText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in send-whatsapp:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
