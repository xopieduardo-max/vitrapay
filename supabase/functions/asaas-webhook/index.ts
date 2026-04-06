import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { autoCreateBuyerAccount } from "../_shared/auto-create-buyer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

async function sendUtmifyPostback(
  supabase: any,
  producerId: string,
  transactionId: string,
  amount: number,
  email: string | null,
  pending: any,
  product: any,
  paymentMethod: string = "pix",
) {
  try {
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("api_token, is_active")
      .eq("user_id", producerId)
      .eq("platform", "utmify")
      .maybeSingle();

    if (!integration || !integration.is_active || !integration.api_token) {
      console.log("UTMify not configured or inactive for producer:", producerId);
      return;
    }

    const now = new Date().toISOString();
    const postbackBody = {
      isTest: false,
      status: "paid",
      orderId: transactionId,
      customer: {
        name: pending?.buyer_name || "Cliente",
        email: email || "",
        phone: "",
        country: "BR",
        document: pending?.buyer_cpf || "",
      },
      commission: {
        totalPriceInCents: amount,
        gatewayFeeInCents: 0,
        userCommissionInCents: amount,
      },
      platform: "VitraPay",
      products: [
        {
          id: product?.id || pending?.product_id || "",
          name: product?.title || "",
          planId: product?.id || pending?.product_id || "",
          planName: product?.title || "",
          quantity: 1,
          priceInCents: amount,
        },
      ],
      createdAt: pending?.created_at || now,
      approvedDate: now,
      paymentMethod: paymentMethod,
      trackingParameters: {
        utm_source: pending?.utm_source || "",
        utm_medium: pending?.utm_medium || "",
        utm_campaign: pending?.utm_campaign || "",
        utm_content: pending?.utm_content || "",
        utm_term: pending?.utm_term || "",
      },
    };

    console.log("UTMify postback SENDING:", JSON.stringify({
      producer: producerId,
      orderId: transactionId,
      amount,
      email: email || "",
      paymentMethod,
      utm_source: pending?.utm_source || "",
      token_prefix: integration.api_token.slice(0, 6) + "...",
    }));

    let lastError: any = null;
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
        console.log(`UTMify postback RESPONSE (attempt ${attempt}):`, res.status, resText);

        if (res.ok || res.status < 500) return;
        lastError = `status ${res.status}: ${resText}`;
      } catch (fetchErr) {
        lastError = fetchErr;
        console.error(`UTMify postback attempt ${attempt} failed:`, fetchErr);
      }

      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    console.error("UTMify postback FAILED after 3 attempts:", lastError);
  } catch (err) {
    console.error("UTMify postback error:", err);
  }
}

async function sendPurchaseEmailNotification(
  supabaseUrl: string,
  buyerName: string,
  buyerEmail: string,
  productTitle: string,
  productType: string,
  productId: string,
  fileUrl: string | null,
  tempPassword: string | null = null
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
        temp_password: tempPassword,
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
    const expectedWebhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedWebhookToken = req.headers.get("asaas-access-token");

    if (!expectedWebhookToken) {
      console.error("ASAAS_WEBHOOK_TOKEN is not configured");
      return jsonResponse({ status: "webhook_token_not_configured" }, 500);
    }

    if (receivedWebhookToken !== expectedWebhookToken) {
      console.warn("Unauthorized Asaas webhook request blocked");
      return jsonResponse({ status: "unauthorized" }, 401);
    }

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

    // ── Handle REFUND / CHARGEBACK / MED events ──
    const isChargeback =
      event === "PAYMENT_CHARGEBACK_REQUESTED" ||
      event === "PAYMENT_CHARGEBACK_DISPUTE" ||
      event === "PAYMENT_CHARGEBACK_CREATED";
    const isRefund = event === "PAYMENT_REFUNDED";
    const isMED =
      event === "PAYMENT_RECEIVED_IN_CASH_UNDONE" ||
      event === "PAYMENT_DUNNING_RECEIVED" && payment?.billingType === "PIX";

    if (isRefund || isChargeback || isMED) {
      const saleStatus = isChargeback ? "chargeback" : isMED ? "med" : "refunded";
      const txnCategory = isChargeback ? "chargeback" : isMED ? "med" : "refund";
      console.log(`Processing ${txnCategory}:`, event, asaasPaymentId);

      await supabase
        .from("pending_payments")
        .update({ status: saleStatus })
        .eq("asaas_payment_id", asaasPaymentId);

      const { data: sale } = await supabase
        .from("sales")
        .select("id, product_id, buyer_id, producer_id, amount")
        .eq("payment_id", asaasPaymentId)
        .maybeSingle();

      if (sale) {
        await supabase.from("sales").update({ status: saleStatus }).eq("id", sale.id);

        // Revoke product access
        await supabase
          .from("product_access")
          .delete()
          .eq("sale_id", sale.id);

        await supabase
          .from("commissions")
          .update({ status: "cancelled" })
          .eq("sale_id", sale.id);

        // Record refund/chargeback transaction
        const refundTxns: any[] = [{
          user_id: sale.producer_id,
          type: "debit",
          category: txnCategory,
          amount: sale.amount,
          balance_type: "available",
          reference_id: sale.id,
        }];

        // Reverse affiliate commission if any
        const { data: saleCommissions } = await supabase
          .from("commissions")
          .select("affiliate_id, amount")
          .eq("sale_id", sale.id);

        if (saleCommissions) {
          for (const c of saleCommissions) {
            refundTxns.push({
              user_id: c.affiliate_id,
              type: "debit",
              category: txnCategory,
              amount: c.amount,
              balance_type: "available",
              reference_id: sale.id,
            });
          }
        }

        await supabase.from("transactions").insert(refundTxns)
          .catch((err: any) => console.error(`${txnCategory} transaction error:`, err));

        // Deduct from producer wallet
        const { data: producerWallet } = await supabase
          .from("wallets")
          .select("id, balance_available, balance_pending, balance_total")
          .eq("user_id", sale.producer_id)
          .maybeSingle();

        if (producerWallet) {
          const deductAvailable = Math.min(sale.amount, Number(producerWallet.balance_available));
          const deductPending = Math.min(sale.amount - deductAvailable, Number(producerWallet.balance_pending));
          await supabase.from("wallets").update({
            balance_available: Math.max(0, Number(producerWallet.balance_available) - deductAvailable),
            balance_pending: Math.max(0, Number(producerWallet.balance_pending) - deductPending),
            balance_total: Math.max(0, Number(producerWallet.balance_total) - sale.amount),
          }).eq("id", producerWallet.id);
          console.log(`Wallet deducted for producer ${sale.producer_id}: -${sale.amount}`);
        }

        // Deduct affiliate commissions from their wallets
        if (saleCommissions) {
          for (const c of saleCommissions) {
            const { data: affWallet } = await supabase
              .from("wallets")
              .select("id, balance_available, balance_pending, balance_total")
              .eq("user_id", c.affiliate_id)
              .maybeSingle();

            if (affWallet) {
              const affDeductAvailable = Math.min(c.amount, Number(affWallet.balance_available));
              const affDeductPending = Math.min(c.amount - affDeductAvailable, Number(affWallet.balance_pending));
              await supabase.from("wallets").update({
                balance_available: Math.max(0, Number(affWallet.balance_available) - affDeductAvailable),
                balance_pending: Math.max(0, Number(affWallet.balance_pending) - affDeductPending),
                balance_total: Math.max(0, Number(affWallet.balance_total) - c.amount),
              }).eq("id", affWallet.id);
              console.log(`Wallet deducted for affiliate ${c.affiliate_id}: -${c.amount}`);
            }
          }
        }

        console.log(`Sale ${saleStatus}:`, sale.id);

        // Send push notification to producer about refund/chargeback
        const amountFormatted = `R$ ${(sale.amount / 100).toFixed(2).replace(".", ",")}`;
        const pushTitle = isChargeback ? "Chargeback Recebido" : isMED ? "MED Pix Recebido" : "Estorno Realizado";
        const pushBody = isChargeback
          ? `Um chargeback de ${amountFormatted} foi aberto. Verifique sua conta.`
          : isMED
          ? `Uma devolução MED (Pix) de ${amountFormatted} foi processada na sua conta.`
          : `Um estorno de ${amountFormatted} foi processado na sua conta.`;

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              producer_id: sale.producer_id,
              title: pushTitle,
              body: pushBody,
              url: "/dashboard",
            }),
          });
          console.log(`Push notification sent to producer ${sale.producer_id} for ${txnCategory}`);
        } catch (pushErr) {
          console.error(`Failed to send ${txnCategory} push notification:`, pushErr);
        }
      }

      return new Response(JSON.stringify({ status: `${txnCategory}_processed` }), {
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
          .select("id, user_id, amount")
          .maybeSingle();

        if (withdrawal) {
          console.log("Withdrawal marked completed via webhook:", withdrawal.id);

          // Notify producer
          try {
            await fetch(`${supabaseUrl}/functions/v1/notify-withdrawal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: withdrawal.user_id,
                amount: withdrawal.amount,
                transfer_id: transferId,
              }),
            });
          } catch (e) {
            console.error("Failed to send withdrawal notification:", e);
          }
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

    // ── Avulso payment (no product_id) — v4 ──
    if (!pending.product_id) {
      const producerId = pending.producer_id;
      console.log("[AVULSO-V4] Payment detected. producer_id:", producerId, "pending.id:", pending.id, "amount:", pending.amount);

      if (!producerId) {
        console.error("Avulso payment missing producer_id:", asaasPaymentId);
        await supabase.from("pending_payments").update({ status: "error" }).eq("id", pending.id);
        return new Response(JSON.stringify({ status: "avulso_missing_producer" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fee: same platform PIX fee
      const FEE_PIX_PLATFORM = 249;
      const SERVICE_FEE = 99;
      const producerNet = Math.max(0, pending.amount - FEE_PIX_PLATFORM - SERVICE_FEE);
      console.log(`Avulso fees: amount=${pending.amount}, platform=${FEE_PIX_PLATFORM}, service=${SERVICE_FEE}, net=${producerNet}`);

      // Record transaction
      const { error: txnErr } = await supabase.from("transactions").insert({
        user_id: producerId,
        type: "credit",
        category: "sale",
        amount: producerNet,
        balance_type: "available",
        reference_id: pending.id,
        release_date: new Date().toISOString(),
        status: "completed",
      });
      if (txnErr) console.error("Avulso transaction error:", JSON.stringify(txnErr));
      else console.log("Avulso transaction recorded ok");

      // Credit wallet (D+0)
      const { error: walletErr } = await supabase.rpc("increment_wallet", {
        p_user_id: producerId,
        p_available_delta: producerNet,
        p_total_delta: producerNet,
      });
      if (walletErr) console.error("Avulso wallet increment error:", JSON.stringify(walletErr));
      else console.log("Avulso wallet incremented ok");

      await supabase.from("pending_payments").update({ status: "confirmed" }).eq("id", pending.id);

      console.log(`Avulso payment confirmed for producer ${producerId}: net=${producerNet}`);

      // Push notification — same style as regular sale
      try {
        const fmtNet = `R$ ${(producerNet / 100).toFixed(2).replace(".", ",")}`;
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producer_id: producerId,
            title: "Venda aprovada no Pix!",
            body: `Sua comissão: ${fmtNet}`,
            url: "/sales",
          }),
        });
      } catch (_) { /* non-critical */ }

      return new Response(JSON.stringify({ status: "avulso_confirmed" }), {
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

    // ── Fee calculation: PIX (fixed fees) ──
    // Platform charges producer: R$ 2,49 (249 centavos)
    // Asaas cost: R$ 1,99 (199 centavos)
    // Service fee: R$ 0,99 (99 centavos) - charged to buyer, goes to platform
    const FEE_PIX_PLATFORM = 249; // R$ 2.49
    const FEE_PIX_ASAAS = 199;    // R$ 1.99
    const SERVICE_FEE = 99;        // R$ 0.99

    // The amount stored in pending_payments includes the service fee
    const productAmount = pending.amount - SERVICE_FEE;

    // Check producer custom overrides
    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("custom_fee_percentage, custom_fee_fixed")
      .eq("user_id", product.producer_id)
      .single();

    let pixPlatformFee = FEE_PIX_PLATFORM;
    if (producerProfile?.custom_fee_fixed != null) {
      pixPlatformFee = producerProfile.custom_fee_fixed;
    } else if (producerProfile?.custom_fee_percentage != null) {
      pixPlatformFee = Math.round(productAmount * producerProfile.custom_fee_percentage / 100);
    }

    console.log(`PIX fees: platform=${pixPlatformFee}, asaas=${FEE_PIX_ASAAS}, serviceFee=${SERVICE_FEE}, profit=${pixPlatformFee - FEE_PIX_ASAAS + SERVICE_FEE}`);

    // Insert sale (amount = product price without service fee)
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        product_id: pending.product_id,
        producer_id: product.producer_id,
        buyer_id: null,
        affiliate_id: affiliateUserId,
        amount: productAmount,
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
    let commissionAmount = 0;
    if (affiliateUserId && product.affiliate_commission > 0 && sale) {
      commissionAmount = Math.round(productAmount * product.affiliate_commission / 100);
      await supabase.from("commissions").insert({
        sale_id: sale.id,
        affiliate_id: affiliateUserId,
        amount: commissionAmount,
        status: "pending",
      }).catch((err: any) => console.error("Commission insert error:", err));
    }

    // ── Record transactions (split) ──
    // PIX: release immediately (D+0)
    const producerNet = productAmount - pixPlatformFee - commissionAmount;
    const netProfit = pixPlatformFee - FEE_PIX_ASAAS + SERVICE_FEE;
    const releaseDate = new Date().toISOString(); // PIX = D+0

    const txns: any[] = [
      {
        user_id: product.producer_id,
        type: "credit",
        category: "sale",
        amount: producerNet,
        balance_type: "available",
        reference_id: sale.id,
        release_date: releaseDate,
        status: "completed", // PIX = immediately completed
      },
    ];

    if (pixPlatformFee > 0) {
      txns.push({
        user_id: product.producer_id,
        type: "debit",
        category: "fee",
        amount: pixPlatformFee,
        balance_type: "available",
        reference_id: sale.id,
        release_date: releaseDate,
        status: "completed",
      });
    }

    if (affiliateUserId && commissionAmount > 0) {
      txns.push({
        user_id: affiliateUserId,
        type: "credit",
        category: "commission",
        amount: commissionAmount,
        balance_type: "available",
        reference_id: sale.id,
        release_date: releaseDate,
        status: "completed",
      });
    }

    // Note: Service fee (R$0.99) is NOT a producer debit — it was never part of 
    // productAmount. It goes directly to platform revenue via the total charged amount.

    await supabase.from("transactions").insert(txns)
      .then(() => console.log("Transactions recorded:", txns.length))
      .catch((err: any) => console.error("Transaction insert error:", err));

    // ── Update wallet: PIX = balance_available (D+0) — atomic to prevent race conditions ──
    console.log(`Updating wallet for producer ${product.producer_id}: +${producerNet} available`);

    await supabase.rpc("increment_wallet", {
      p_user_id: product.producer_id,
      p_available_delta: producerNet,
      p_total_delta: producerNet,
    }).then(({ error }: any) => { if (error) console.error("Wallet increment error (producer):", error); });

    if (affiliateUserId && commissionAmount > 0) {
      await supabase.rpc("increment_wallet", {
        p_user_id: affiliateUserId,
        p_available_delta: commissionAmount,
        p_total_delta: commissionAmount,
      }).then(({ error }: any) => { if (error) console.error("Wallet increment error (affiliate):", error); });
    }

    console.log(`Sale processed: PIX D+0, producer_net=${producerNet}, profit=${netProfit}, release=${releaseDate}`);

    // ✅ Send push notification for confirmed sale
    try {
      const fmtNet = `R$ ${(producerNet / 100).toFixed(2).replace(".", ",")}`;
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer_id: product.producer_id,
          title: "Venda aprovada no Pix!",
          body: `Sua comissão: ${fmtNet}`,
          url: "/sales",
        }),
      });
    } catch (_) { /* non-critical */ }

    // ✅ Grant product access
    await grantProductAccess(supabase, pending.product_id, pending.buyer_email, sale.id);

    // ✅ Auto-create buyer account if needed
    let tempPassword: string | null = null;
    if (pending.buyer_email) {
      const accountResult = await autoCreateBuyerAccount(
        supabase,
        pending.buyer_email,
        pending.buyer_name || "Cliente",
        pending.buyer_cpf || null
      );
      tempPassword = accountResult.tempPassword;

      // Link user_id to product_access if we have it
      if (accountResult.userId) {
        await supabase
          .from("product_access")
          .update({ user_id: accountResult.userId })
          .eq("sale_id", sale.id)
          .is("user_id", null);
      }
    }

    // ✅ Send purchase confirmation email (with temp password if new account)
    if (pending.buyer_email) {
      await sendPurchaseEmailNotification(
        supabaseUrl,
        pending.buyer_name || "Cliente",
        pending.buyer_email,
        product.title,
        product.type,
        product.id,
        product.file_url,
        tempPassword
      );
    }

    // ✅ Send UTMify postback
    await sendUtmifyPostback(supabase, product.producer_id, asaasPaymentId, pending.amount, pending.buyer_email, pending, product, "pix");

    // ✅ Send Facebook Conversion API (CAPI) Purchase event
    try {
      const capiRes = await fetch(`${supabaseUrl}/functions/v1/send-facebook-capi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: pending.product_id,
          payment_id: asaasPaymentId,
          amount: pending.amount,
          buyer_email: pending.buyer_email || null,
          buyer_name: pending.buyer_name || null,
          buyer_phone: null,
          buyer_cpf: pending.buyer_cpf || null,
        }),
      });
      console.log("Facebook CAPI dispatch status:", capiRes.status);
    } catch (capiErr) {
      console.error("Facebook CAPI dispatch failed:", capiErr);
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
