import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { product_id, buyer_email, buyer_name, amount, payment_method, affiliate_ref } = body;

    // Input validation
    if (!product_id || !buyer_email || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyer_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate amount is positive integer
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100000000) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate payment method
    const validMethods = ["card", "pix", "boleto", "simulated"];
    if (payment_method && !validMethods.includes(payment_method)) {
      return new Response(JSON.stringify({ error: "Invalid payment method" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get product
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .single();

    if (prodErr || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate platform fee based on payment method
    // Card: 3.89% + R$2.49 | Pix: 0%
    let platformFee = 0;
    if (payment_method === "card") {
      platformFee = Math.round(amount * 0.0389 + 249);
    }

    // Check affiliate
    let affiliateId: string | null = null;
    if (affiliate_ref) {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("user_id")
        .eq("id", affiliate_ref)
        .eq("product_id", product_id)
        .single();
      if (aff) affiliateId = aff.user_id;

      // Track click
      await supabase.rpc("increment_affiliate_clicks", { affiliate_id: affiliate_ref }).catch(() => {});
    }

    // Insert sale
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        product_id,
        producer_id: product.producer_id,
        buyer_id: null, // no account needed
        affiliate_id: affiliateId,
        amount,
        platform_fee: platformFee,
        payment_provider: payment_method || "simulated",
        payment_id: `sim_${crypto.randomUUID().slice(0, 8)}`,
        status: "completed",
      })
      .select()
      .single();

    if (saleErr) throw saleErr;

    // If affiliate, create commission
    if (affiliateId && product.affiliate_commission > 0) {
      const commissionAmount = Math.round(amount * product.affiliate_commission / 100);
      await supabase.from("commissions").insert({
        sale_id: sale.id,
        affiliate_id: affiliateId,
        amount: commissionAmount,
        status: "pending",
      });
    }

    // If coupon was used, increment uses
    // (handled client-side for now)

    return new Response(JSON.stringify({
      success: true,
      sale_id: sale.id,
      product_title: product.title,
      product_type: product.type,
      file_url: product.file_url,
      amount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
