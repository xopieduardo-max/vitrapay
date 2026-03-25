import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function mapAsaasError(desc: string): string {
  const lower = desc.toLowerCase();
  if (lower.includes("saldo") || lower.includes("limite")) return "Cartão sem limite disponível. Tente outro cartão.";
  if (lower.includes("bloqueado")) return "Cartão bloqueado. Entre em contato com seu banco.";
  if (lower.includes("expirado") || lower.includes("vencido")) return "Cartão vencido. Verifique a validade.";
  if (lower.includes("recusad")) return "Pagamento recusado pelo banco. Tente outro cartão.";
  if (lower.includes("cpf") || lower.includes("cnpj")) return "CPF/CNPJ inválido. Verifique os dados.";
  if (lower.includes("número do cartão") || lower.includes("card number")) return "Número do cartão inválido.";
  if (lower.includes("cvv") || lower.includes("ccv")) return "Código de segurança (CVV) inválido.";
  if (lower.includes("valor") || lower.includes("value")) return "Valor inválido para esta transação.";
  return desc;
}

function isValidCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length === 14) return true;
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      product_id, buyer_name, buyer_email, buyer_cpf, buyer_phone, buyer_postal_code,
      card_number, card_holder_name, card_expiry_month, card_expiry_year, card_cvv,
      installments, amount, service_fee, affiliate_ref,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term
    } = await req.json();
    const SERVICE_FEE = service_fee || 99; // R$ 0.99 default
    const productAmount = amount - SERVICE_FEE; // Amount without service fee for fee calculation

    if (!product_id || !amount || !buyer_cpf || !buyer_name || !buyer_email) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: product_id, amount, buyer_cpf, buyer_name, buyer_email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!card_number || !card_holder_name || !card_expiry_month || !card_expiry_year || !card_cvv) {
      return new Response(JSON.stringify({ error: "Dados do cartão incompletos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "Valor inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount < 500) {
      return new Response(JSON.stringify({ error: "Valor mínimo para cartão de crédito é R$ 5,00. Use PIX para valores menores." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cpfClean = buyer_cpf.replace(/\D/g, "");
    if (!isValidCPF(cpfClean)) {
      return new Response(JSON.stringify({ error: "CPF/CNPJ inválido. Verifique os dados e tente novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const { data: product, error: prodErr } = await supabase
      .from("products").select("*").eq("id", product_id).single();

    if (prodErr || !product) {
      return new Response(JSON.stringify({ error: "Produto não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!product.is_published) {
      return new Response(JSON.stringify({ error: "Produto não disponível" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: "Gateway de pagamento não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneClean = (buyer_phone || "").replace(/\D/g, "") || "11999999999";
    const postalCode = (buyer_postal_code || "").replace(/\D/g, "") || "69000000";

    // Create or find customer
    let customerId: string | null = null;
    console.log(`Looking up customer with CPF: ${cpfClean.slice(0, 3)}***`);

    const searchRes = await fetch(
      `https://api.asaas.com/v3/customers?cpfCnpj=${cpfClean}`,
      { headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY } }
    );
    const searchData = await searchRes.json();

    if (searchData?.data?.length > 0) {
      customerId = searchData.data[0].id;
      await fetch(`https://api.asaas.com/v3/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify({ name: buyer_name, email: buyer_email, cpfCnpj: cpfClean }),
      });
    } else {
      const customerRes = await fetch("https://api.asaas.com/v3/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify({ name: buyer_name, email: buyer_email, cpfCnpj: cpfClean }),
      });
      const customerData = await customerRes.json();
      if (customerData?.id) {
        customerId = customerData.id;
      } else {
        const errMsg = customerData?.errors?.[0]?.description || "Falha ao criar cliente";
        return new Response(JSON.stringify({ error: mapAsaasError(errMsg) }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: "CPF/CNPJ inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valueInReais = amount / 100;
    const dueDate = new Date().toISOString().split("T")[0];
    const externalReference = `${product_id}|${affiliate_ref || ""}`;
    const cardNumberClean = card_number.replace(/\D/g, "");
    const installmentCount = parseInt(installments || "1", 10) || 1;

    const paymentPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: valueInReais,
      dueDate,
      description: `Compra na VitraPay - ${product.title}`,
      externalReference,
      creditCard: {
        holderName: card_holder_name,
        number: cardNumberClean,
        expiryMonth: card_expiry_month,
        expiryYear: card_expiry_year,
        ccv: card_cvv,
      },
      creditCardHolderInfo: {
        name: buyer_name,
        email: buyer_email,
        cpfCnpj: cpfClean,
        postalCode,
        addressNumber: "123",
        phone: phoneClean,
      },
    };

    if (installmentCount > 1) {
      paymentPayload.installmentCount = installmentCount;
      paymentPayload.installmentValue = parseFloat((valueInReais / installmentCount).toFixed(2));
    }

    console.log("Creating card payment, value:", valueInReais, "installments:", installmentCount);

    const paymentRes = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentRes.json();
    console.log(`Payment status: ${paymentRes.status}, asaas_status: ${paymentData?.status}, id: ${paymentData?.id}`);

    if (!paymentData?.id) {
      const errorMsg = paymentData?.errors?.[0]?.description || "Falha ao processar pagamento";
      console.error("Payment failed:", JSON.stringify(paymentData));
      return new Response(JSON.stringify({ error: mapAsaasError(errorMsg), details: paymentData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to pending_payments
    await supabase.from("pending_payments").insert({
      asaas_payment_id: paymentData.id,
      product_id, buyer_name, buyer_email, buyer_cpf: cpfClean,
      amount, affiliate_ref: affiliate_ref || null,
      status: paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED" ? "confirmed" : "pending",
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
    });

    // Send push notification for pending card payment
    if (paymentData.status !== "CONFIRMED" && paymentData.status !== "RECEIVED") {
      try {
        const fmtValue = `R$ ${(amount / 100).toFixed(2).replace('.', ',')}`;
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producer_id: product.producer_id,
            title: "Cartão Gerado! 💳",
            body: `Pagamento de ${fmtValue} via cartão gerado para ${product.title}`,
            url: "/sales",
          }),
        });
      } catch (pushErr) {
        console.error("Push notification error:", pushErr);
      }
    }

    // If payment confirmed immediately, process sale + access + email
    if (paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED") {
      const { data: existingSale } = await supabase
        .from("sales").select("id").eq("payment_id", paymentData.id).maybeSingle();

      if (existingSale) {
        return new Response(JSON.stringify({
          success: true, status: "CONFIRMED", payment_id: paymentData.id,
          product_title: product.title, product_type: product.type,
          file_url: product.file_url, amount, sale_id: existingSale.id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── Fee calculation: Card (D+2 or D+30 based on producer setting) ──
      const { data: producerProfile } = await supabase
        .from("profiles").select("custom_fee_percentage, custom_fee_fixed, card_plan")
        .eq("user_id", product.producer_id).single();

      const cardPlan = producerProfile?.card_plan || "d2";
      const isD2 = cardPlan === "d2";

      // D+2: 4.99% + R$2.49 (Asaas: 4.14% + R$0.49)
      // D+30: 3.99% + R$2.49 (Asaas: 2.99% + R$0.49)
      const PLATFORM_PCT = isD2 ? 0.0499 : 0.0399;
      const PLATFORM_FIXED = 249;
      const ASAAS_PCT = isD2 ? 0.0414 : 0.0299;
      const ASAAS_FIXED = 49;
      const holdDays = isD2 ? 2 : 30;

      let platformFee: number;
      if (producerProfile?.custom_fee_fixed != null) {
        platformFee = producerProfile.custom_fee_fixed;
      } else if (producerProfile?.custom_fee_percentage != null) {
        platformFee = Math.round(productAmount * producerProfile.custom_fee_percentage / 100 + PLATFORM_FIXED);
      } else {
        platformFee = Math.round(productAmount * PLATFORM_PCT + PLATFORM_FIXED);
      }

      const asaasCost = Math.round(productAmount * ASAAS_PCT + ASAAS_FIXED);
      const netProfit = platformFee - asaasCost + SERVICE_FEE;
      console.log(`Card ${cardPlan} fees: platform=${platformFee}, asaas=${asaasCost}, serviceFee=${SERVICE_FEE}, profit=${netProfit}`);

      let affiliateId: string | null = null;
      if (affiliate_ref) {
        const { data: aff } = await supabase
          .from("affiliates").select("user_id")
          .eq("id", affiliate_ref).eq("product_id", product_id).single();
        if (aff) affiliateId = aff.user_id;
      }

      const { data: sale } = await supabase
        .from("sales")
        .insert({
          product_id, producer_id: product.producer_id, buyer_id: null,
          affiliate_id: affiliateId, amount: productAmount, platform_fee: platformFee,
          payment_provider: "card", payment_id: paymentData.id, status: "completed",
          payment_provider: "card", payment_id: paymentData.id, status: "completed",
        })
        .select().single();

      let commissionAmount = 0;
      if (sale && affiliateId && product.affiliate_commission > 0) {
        commissionAmount = Math.round(amount * product.affiliate_commission / 100);
        await supabase.from("commissions").insert({
          sale_id: sale.id, affiliate_id: affiliateId,
          amount: commissionAmount, status: "pending",
        });
      }

      // ── Record transactions (split) ──
      // Card: release D+2 (pending balance)
      if (sale) {
        const producerNet = amount - platformFee - commissionAmount;
        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() + 2); // D+2
        const releaseDateStr = releaseDate.toISOString();

        const txns: any[] = [
          {
            user_id: product.producer_id,
            type: "credit",
            category: "sale",
            amount: producerNet,
            balance_type: "pending",
            reference_id: sale.id,
            release_date: releaseDateStr,
            status: "pending", // Card = pending until D+2
          },
        ];

        if (platformFee > 0) {
          txns.push({
            user_id: product.producer_id,
            type: "debit",
            category: "fee",
            amount: platformFee,
            balance_type: "pending",
            reference_id: sale.id,
            release_date: releaseDateStr,
            status: "pending",
          });
        }

        if (affiliateId && commissionAmount > 0) {
          txns.push({
            user_id: affiliateId,
            type: "credit",
            category: "commission",
            amount: commissionAmount,
            balance_type: "pending",
            reference_id: sale.id,
            release_date: releaseDateStr,
            status: "pending",
          });
        }

        await supabase.from("transactions").insert(txns)
          .catch((err: any) => console.error("Transaction insert error:", err));

        // ── Update wallet: Card = balance_pending (D+2) ──
        console.log(`Updating wallet for producer ${product.producer_id}: +${producerNet} pending (release: ${releaseDateStr})`);

        const { data: existingWallet } = await supabase
          .from("wallets")
          .select("id, balance_pending, balance_total")
          .eq("user_id", product.producer_id)
          .maybeSingle();

        if (existingWallet) {
          await supabase.from("wallets").update({
            balance_pending: Number(existingWallet.balance_pending) + producerNet,
            balance_total: Number(existingWallet.balance_total) + producerNet,
          }).eq("id", existingWallet.id);
        } else {
          await supabase.from("wallets").insert({
            user_id: product.producer_id,
            balance_available: 0,
            balance_pending: producerNet,
            balance_total: producerNet,
          });
        }

        // Update affiliate wallet if applicable
        if (affiliateId && commissionAmount > 0) {
          const { data: affWallet } = await supabase
            .from("wallets")
            .select("id, balance_pending, balance_total")
            .eq("user_id", affiliateId)
            .maybeSingle();

          if (affWallet) {
            await supabase.from("wallets").update({
              balance_pending: Number(affWallet.balance_pending) + commissionAmount,
              balance_total: Number(affWallet.balance_total) + commissionAmount,
            }).eq("id", affWallet.id);
          } else {
            await supabase.from("wallets").insert({
              user_id: affiliateId,
              balance_available: 0,
              balance_pending: commissionAmount,
              balance_total: commissionAmount,
            });
          }
        }

        console.log(`Sale processed: Card D+2, producer_net=${producerNet}, profit=${netProfit}, release=${releaseDateStr}`);
      }

      // ✅ Grant product access
      if (sale) {
        const accessRow: any = {
          product_id,
          sale_id: sale.id,
          buyer_email,
        };
        const { data: existingAccess } = await supabase
          .from("product_access").select("id")
          .eq("product_id", product_id).eq("sale_id", sale.id).maybeSingle();

        if (!existingAccess) {
          await supabase.from("product_access").insert(accessRow);
          console.log("Product access granted for card payment:", product_id);
        }

        // ✅ Send purchase confirmation email
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              buyer_name: buyer_name || "Cliente",
              buyer_email,
              product_title: product.title,
              product_type: product.type,
              product_id: product.id,
              file_url: product.file_url,
            }),
          });
        } catch (emailErr) {
          console.error("Email notification error:", emailErr);
        }
      }

      // ✅ Send UTMify postback (per-producer token)
      try {
        const { data: utmIntegration } = await supabase
          .from("user_integrations")
          .select("api_token, is_active")
          .eq("user_id", product.producer_id)
          .eq("platform", "utmify")
          .maybeSingle();

        if (utmIntegration?.is_active && utmIntegration?.api_token) {
          const now = new Date().toISOString();
          const postbackBody = {
            isTest: false,
            status: "paid",
            orderId: paymentData.id,
            customer: {
              name: buyer_name || "Cliente",
              email: buyer_email || "",
              phone: buyer_phone || "",
              country: "BR",
              document: buyer_cpf || "",
            },
            platform: "VitraPay",
            products: [
              {
                id: product.id,
                name: product.title,
                planId: product.id,
                planName: product.title,
                quantity: 1,
                priceInCents: amount,
              },
            ],
            createdAt: now,
            approvedDate: now,
            paymentMethod: "credit_card",
            trackingParameters: {
              utm_source: utm_source || "",
              utm_medium: utm_medium || "",
              utm_campaign: utm_campaign || "",
              utm_content: utm_content || "",
              utm_term: utm_term || "",
            },
          };

          console.log("UTMify card postback SENDING:", JSON.stringify({
            producer: product.producer_id,
            orderId: paymentData.id,
            amount,
            token_prefix: utmIntegration.api_token.slice(0, 6) + "...",
          }));

          let lastError: any = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const utmRes = await fetch("https://api.utmify.com.br/api-credentials/orders", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-token": utmIntegration.api_token,
                },
                body: JSON.stringify(postbackBody),
              });
              const utmResText = await utmRes.text();
              console.log(`UTMify card postback RESPONSE (attempt ${attempt}):`, utmRes.status, utmResText);
              if (utmRes.ok || utmRes.status < 500) break;
              lastError = `status ${utmRes.status}: ${utmResText}`;
            } catch (fetchErr) {
              lastError = fetchErr;
              console.error(`UTMify card postback attempt ${attempt} failed:`, fetchErr);
            }
            if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
          if (lastError) console.error("UTMify card postback FAILED after retries:", lastError);
        } else {
          console.log("UTMify not configured for producer:", product.producer_id);
        }
      } catch (utmErr) {
        console.error("UTMify postback error:", utmErr);
      }

      // ✅ Send Facebook Conversion API (CAPI) Purchase event
      try {
        const capiRes = await fetch(`${supabaseUrl}/functions/v1/send-facebook-capi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id,
            payment_id: paymentData.id,
            amount,
            buyer_email: buyer_email || null,
            buyer_name: buyer_name || null,
            buyer_phone: buyer_phone || null,
            buyer_cpf: buyer_cpf || null,
          }),
        });
        console.log("Facebook CAPI card dispatch status:", capiRes.status);
      } catch (capiErr) {
        console.error("Facebook CAPI card dispatch failed:", capiErr);
      }

      return new Response(JSON.stringify({
        success: true, status: "CONFIRMED", payment_id: paymentData.id,
        product_title: product.title, product_type: product.type,
        file_url: product.file_url, amount, sale_id: sale?.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true, status: paymentData.status,
      payment_id: paymentData.id, product_title: product.title, amount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
