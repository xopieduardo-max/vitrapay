import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function grantProductAccess(
  supabase: any,
  productId: string,
  buyerEmail: string | null,
  saleId: string,
  buyerId: string | null = null
) {
  if (!buyerEmail && !buyerId) return;

  // Check for duplicates
  let query = supabase
    .from("product_access")
    .select("id")
    .eq("product_id", productId)
    .eq("sale_id", saleId);

  const { data: existing } = await query.maybeSingle();
  if (existing) {
    console.log("Product access already granted for sale:", saleId);
    return;
  }

  const accessRow: any = {
    product_id: productId,
    sale_id: saleId,
  };

  if (buyerId) accessRow.user_id = buyerId;
  if (buyerEmail) accessRow.buyer_email = buyerEmail;

  const { error } = await supabase.from("product_access").insert(accessRow);
  if (error) {
    console.error("Failed to grant product access:", error);
  } else {
    console.log("Product access granted:", productId, "email:", buyerEmail);
  }
}

async function sendPurchaseEmailNotification(
  supabaseUrl: string,
  buyerName: string,
  buyerEmail: string,
  productTitle: string,
  productType: string,
  productId: string,
  fileUrl: string | null
) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        product_title: productTitle,
        product_type: productType,
        product_id: productId,
        file_url: fileUrl,
      }),
    });
    console.log("Purchase email dispatch status:", res.status);
  } catch (err) {
    console.error("Failed to send purchase email:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const event = body?.event;
    const payment = body?.payment;

    if (!payment?.id) {
      return new Response(JSON.stringify({ status: "no_payment_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const asaasPaymentId = payment.id;

    // ── Handle REFUND / CHARGEBACK events ──
    if (
      event === "PAYMENT_REFUNDED" ||
      event === "PAYMENT_CHARGEBACK_REQUESTED" ||
      event === "PAYMENT_CHARGEBACK_DISPUTE" ||
      event === "PAYMENT_CHARGEBACK_CREATED"
    ) {
      console.log("Processing refund/chargeback:", event, asaasPaymentId);

      await supabase
        .from("pending_payments")
        .update({ status: "refunded" })
        .eq("asaas_payment_id", asaasPaymentId);

      const { data: sale } = await supabase
        .from("sales")
        .select("id, product_id, buyer_id, producer_id, amount")
        .eq("payment_id", asaasPaymentId)
        .maybeSingle();

      if (sale) {
        await supabase.from("sales").update({ status: "refunded" }).eq("id", sale.id);

        // Revoke product access
        await supabase
          .from("product_access")
          .delete()
          .eq("sale_id", sale.id);

        await supabase
          .from("commissions")
          .update({ status: "cancelled" })
          .eq("sale_id", sale.id);

        console.log("Sale refunded:", sale.id);
      }

      return new Response(JSON.stringify({ status: "refund_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Handle TRANSFER events ──
    if (event === "TRANSFER_CONFIRMED" || event === "TRANSFER_COMPLETED") {
      const transferId = body?.transfer?.id || payment?.id;
      console.log("Transfer confirmed:", transferId);

      if (transferId) {
        const { data: withdrawal, error: wErr } = await supabase
          .from("withdrawals")
          .update({ status: "completed", paid_at: new Date().toISOString() })
          .eq("transfer_id", transferId)
          .eq("status", "processing")
          .select("id")
          .maybeSingle();

        if (withdrawal) {
          console.log("Withdrawal marked completed via webhook:", withdrawal.id);
        } else {
          console.log("No matching processing withdrawal for transfer:", transferId, wErr);
        }
      }

      return new Response(JSON.stringify({ status: "transfer_confirmed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "TRANSFER_FAILED" || event === "TRANSFER_CANCELLED") {
      const transferId = body?.transfer?.id || payment?.id;
      console.log("Transfer failed:", transferId, event);

      if (transferId) {
        const { data: withdrawal } = await supabase
          .from("withdrawals")
          .update({ status: "pending" })
          .eq("transfer_id", transferId)
          .in("status", ["processing", "completed"])
          .select("id")
          .maybeSingle();

        if (withdrawal) {
          console.log("Withdrawal reverted to pending:", withdrawal.id);
        }
      }

      return new Response(JSON.stringify({ status: "transfer_failed_handled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Handle CONFIRMED / RECEIVED events ──
    if (event !== "PAYMENT_CONFIRMED" && event !== "PAYMENT_RECEIVED") {
      console.log("Ignoring event:", event);
      return new Response(JSON.stringify({ status: "ignored", event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find pending payment
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_payments")
      .select("*")
      .eq("asaas_payment_id", asaasPaymentId)
      .single();

    if (pendingErr || !pending) {
      console.log("Pending payment not found:", asaasPaymentId);
      return new Response(JSON.stringify({ status: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pending.status === "confirmed") {
      console.log("Already processed:", asaasPaymentId);
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if sale already exists
    const { data: existingSale } = await supabase
      .from("sales")
      .select("id")
      .eq("payment_id", asaasPaymentId)
      .maybeSingle();

    if (existingSale) {
      await supabase.from("pending_payments").update({ status: "confirmed" }).eq("id", pending.id);

      // Grant access even if sale was already created by card flow
      await grantProductAccess(supabase, pending.product_id, pending.buyer_email, existingSale.id);

      console.log("Sale already exists, access granted:", asaasPaymentId);
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
      await supabase.from("pending_payments").update({ status: "error" }).eq("id", pending.id);
      return new Response(JSON.stringify({ status: "product_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check affiliate
    let affiliateUserId: string | null = null;
    if (pending.affiliate_ref) {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("user_id")
        .eq("id", pending.affiliate_ref)
        .eq("product_id", pending.product_id)
        .maybeSingle();
      if (aff) affiliateUserId = aff.user_id;
    }

    // Calculate platform fee
    let pixFeePercentage = 0;
    let pixFeeFixed = 0;
    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("custom_fee_percentage, custom_fee_fixed")
      .eq("user_id", product.producer_id)
      .single();
    if (producerProfile) {
      if (producerProfile.custom_fee_percentage != null) pixFeePercentage = producerProfile.custom_fee_percentage / 100;
      if (producerProfile.custom_fee_fixed != null) pixFeeFixed = producerProfile.custom_fee_fixed;
    }
    const pixPlatformFee = (pixFeePercentage > 0 || pixFeeFixed > 0)
      ? Math.round(pending.amount * pixFeePercentage + pixFeeFixed)
      : 0;

    // Insert sale
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        product_id: pending.product_id,
        producer_id: product.producer_id,
        buyer_id: null,
        affiliate_id: affiliateUserId,
        amount: pending.amount,
        platform_fee: pixPlatformFee,
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

    // Create affiliate commission
    if (affiliateUserId && product.affiliate_commission > 0 && sale) {
      const commissionAmount = Math.round(pending.amount * product.affiliate_commission / 100);
      await supabase.from("commissions").insert({
        sale_id: sale.id,
        affiliate_id: affiliateUserId,
        amount: commissionAmount,
        status: "pending",
      }).catch((err: any) => console.error("Commission insert error:", err));
    }

    // ✅ Grant product access
    await grantProductAccess(supabase, pending.product_id, pending.buyer_email, sale.id);

    // ✅ Send purchase confirmation email
    if (pending.buyer_email) {
      await sendPurchaseEmailNotification(
        supabaseUrl,
        pending.buyer_name || "Cliente",
        pending.buyer_email,
        product.title,
        product.type,
        product.id,
        product.file_url
      );
    }

    // Update pending payment status
    await supabase.from("pending_payments").update({ status: "confirmed" }).eq("id", pending.id);

    console.log("Payment confirmed:", asaasPaymentId, "Sale:", sale?.id);

    return new Response(JSON.stringify({ status: "ok", sale_id: sale?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ status: "error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
