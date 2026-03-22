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
      installments, amount, affiliate_ref,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term
    } = await req.json();

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

      // Calculate fees
      let feePercentage = 0.0389;
      let feeFixed = 249;
      const { data: producerProfile } = await supabase
        .from("profiles").select("custom_fee_percentage, custom_fee_fixed")
        .eq("user_id", product.producer_id).single();
      if (producerProfile) {
        if (producerProfile.custom_fee_percentage != null) feePercentage = producerProfile.custom_fee_percentage / 100;
        if (producerProfile.custom_fee_fixed != null) feeFixed = producerProfile.custom_fee_fixed;
      }
      const platformFee = Math.round(amount * feePercentage + feeFixed);

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
          affiliate_id: affiliateId, amount, platform_fee: platformFee,
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
      if (sale) {
        const producerNet = amount - platformFee - commissionAmount;
        const txns: any[] = [
          {
            user_id: product.producer_id,
            type: "credit",
            category: "sale",
            amount: producerNet,
            balance_type: "available",
            reference_id: sale.id,
          },
        ];

        if (platformFee > 0) {
          txns.push({
            user_id: product.producer_id,
            type: "debit",
            category: "fee",
            amount: platformFee,
            balance_type: "available",
            reference_id: sale.id,
          });
        }

        if (affiliateId && commissionAmount > 0) {
          txns.push({
            user_id: affiliateId,
            type: "credit",
            category: "commission",
            amount: commissionAmount,
            balance_type: "available",
            reference_id: sale.id,
          });
        }

        await supabase.from("transactions").insert(txns)
          .catch((err: any) => console.error("Transaction insert error:", err));
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
