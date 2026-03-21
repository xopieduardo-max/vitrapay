import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const event = body?.event;
    const payment = body?.payment;

    // Only process confirmed payments
    if (event !== "PAYMENT_CONFIRMED" && event !== "PAYMENT_RECEIVED") {
      console.log("Ignoring event:", event);
      return new Response(JSON.stringify({ status: "ignored", event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment?.id) {
      console.log("No payment id in webhook payload");
      return new Response(JSON.stringify({ status: "no_payment_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const asaasPaymentId = payment.id;

    // Find pending payment
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_payments")
      .select("*")
      .eq("asaas_payment_id", asaasPaymentId)
      .single();

    if (pendingErr || !pending) {
      console.log("Pending payment not found for:", asaasPaymentId);
      return new Response(JSON.stringify({ status: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: already processed
    if (pending.status === "confirmed") {
      console.log("Already processed:", asaasPaymentId);
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if sale already exists with this payment_id (double safety)
    const { data: existingSale } = await supabase
      .from("sales")
      .select("id")
      .eq("payment_id", asaasPaymentId)
      .maybeSingle();

    if (existingSale) {
      // Sale exists, just update pending status
      await supabase
        .from("pending_payments")
        .update({ status: "confirmed" })
        .eq("id", pending.id);

      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get product info
    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", pending.product_id)
      .single();

    if (!product) {
      console.error("Product not found:", pending.product_id);
      await supabase
        .from("pending_payments")
        .update({ status: "error" })
        .eq("id", pending.id);

      return new Response(JSON.stringify({ status: "product_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check affiliate
    let affiliateUserId: string | null = null;
    const affiliateRef = pending.affiliate_ref;

    if (affiliateRef) {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("user_id")
        .eq("id", affiliateRef)
        .eq("product_id", pending.product_id)
        .maybeSingle();

      if (aff) affiliateUserId = aff.user_id;
    }

    // Insert sale (PIX has 0% platform fee)
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        product_id: pending.product_id,
        producer_id: product.producer_id,
        buyer_id: null,
        affiliate_id: affiliateUserId,
        amount: pending.amount,
        platform_fee: 0,
        payment_provider: "pix",
        payment_id: asaasPaymentId,
        status: "completed",
      })
      .select()
      .single();

    if (saleErr) {
      console.error("Failed to insert sale:", saleErr);
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create affiliate commission if applicable
    if (affiliateUserId && product.affiliate_commission > 0 && sale) {
      const commissionAmount = Math.round(pending.amount * product.affiliate_commission / 100);
      await supabase.from("commissions").insert({
        sale_id: sale.id,
        affiliate_id: affiliateUserId,
        amount: commissionAmount,
        status: "pending",
      }).catch((err) => console.error("Commission insert error:", err));
    }

    // Update pending payment status
    await supabase
      .from("pending_payments")
      .update({ status: "confirmed" })
      .eq("id", pending.id);

    console.log("Payment confirmed successfully:", asaasPaymentId, "Sale:", sale?.id);

    return new Response(JSON.stringify({ status: "ok", sale_id: sale?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook error:", err);
    // Always return 200 to avoid Asaas retries
    return new Response(JSON.stringify({ status: "error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
