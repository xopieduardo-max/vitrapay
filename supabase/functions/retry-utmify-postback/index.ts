import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { payment_id } = await req.json();
    if (!payment_id) {
      return new Response(JSON.stringify({ error: "payment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get sale record
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .select("id, producer_id, amount, payment_id, utmify_postback_sent")
      .eq("payment_id", payment_id)
      .maybeSingle();

    if (saleErr || !sale) {
      return new Response(JSON.stringify({ error: "sale not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sale.utmify_postback_sent) {
      return new Response(JSON.stringify({ status: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending payment data (UTM info, buyer info)
    const { data: pending } = await supabase
      .from("pending_payments")
      .select("*")
      .eq("asaas_payment_id", payment_id)
      .maybeSingle();

    // Get product info
    const productId = pending?.product_id || sale.product_id;
    const { data: product } = await supabase
      .from("products")
      .select("id, title, producer_id")
      .eq("id", productId)
      .maybeSingle();

    if (!product) {
      return new Response(JSON.stringify({ error: "product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get UTMify integration token
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("api_token, is_active")
      .eq("user_id", product.producer_id)
      .eq("platform", "utmify")
      .maybeSingle();

    if (!integration || !integration.is_active || !integration.api_token) {
      return new Response(JSON.stringify({ status: "utmify_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const postbackBody = {
      isTest: false,
      status: "paid",
      orderId: payment_id,
      customer: {
        name: pending?.buyer_name || "Cliente",
        email: pending?.buyer_email || "",
        phone: "",
        country: "BR",
        document: pending?.buyer_cpf || "",
      },
      commission: {
        totalPriceInCents: sale.amount,
        gatewayFeeInCents: 0,
        userCommissionInCents: sale.amount,
      },
      platform: "VitraPay",
      products: [
        {
          id: product.id,
          name: product.title,
          planId: product.id,
          planName: product.title,
          quantity: 1,
          priceInCents: sale.amount,
        },
      ],
      createdAt: pending?.created_at || now,
      approvedDate: now,
      paymentMethod: "pix",
      trackingParameters: {
        utm_source: pending?.utm_source || "",
        utm_medium: pending?.utm_medium || "",
        utm_campaign: pending?.utm_campaign || "",
        utm_content: pending?.utm_content || "",
        utm_term: pending?.utm_term || "",
      },
    };

    let lastError: any = null;
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch("https://api.utmify.com.br/api-credentials/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-token": integration.api_token,
          },
          body: JSON.stringify(postbackBody),
        });

        const resText = await res.text();
        console.log(`UTMify retry (attempt ${attempt}):`, res.status, resText);

        if (res.ok || res.status < 500) {
          success = true;
          break;
        }
        lastError = `status ${res.status}: ${resText}`;
      } catch (fetchErr) {
        lastError = fetchErr;
        console.error(`UTMify retry attempt ${attempt} failed:`, fetchErr);
      }

      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    if (success) {
      await supabase.from("sales").update({ utmify_postback_sent: true }).eq("id", sale.id);
      return new Response(JSON.stringify({ status: "sent", sale_id: sale.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ status: "failed", error: String(lastError) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Retry error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
