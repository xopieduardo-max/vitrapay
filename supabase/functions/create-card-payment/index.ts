import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      product_id, buyer_name, buyer_email, buyer_cpf, buyer_phone,
      card_number, card_holder_name, card_expiry_month, card_expiry_year, card_cvv,
      installments, amount, affiliate_ref
    } = await req.json();

    // Validate required fields
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify product
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .single();

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

    const cpfClean = buyer_cpf.replace(/\D/g, "");
    const phoneClean = (buyer_phone || "").replace(/\D/g, "") || "11999999999";

    // Create or find customer
    let customerId: string | null = null;

    const searchRes = await fetch(
      `https://api.asaas.com/v3/customers?cpfCnpj=${cpfClean}`,
      { headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY } }
    );
    const searchData = await searchRes.json();

    if (searchData?.data?.length > 0) {
      customerId = searchData.data[0].id;
      // Update customer info
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
      console.log("Asaas customer create response:", JSON.stringify(customerData));
      if (customerData?.id) customerId = customerData.id;
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: "CPF/CNPJ inválido. Verifique os dados e tente novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build payment payload
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
        postalCode: "69000000",
        addressNumber: "123",
        phone: phoneClean,
      },
    };

    // Only add installment fields when more than 1
    if (installmentCount > 1) {
      paymentPayload.installmentCount = installmentCount;
      paymentPayload.installmentValue = parseFloat((valueInReais / installmentCount).toFixed(2));
    }

    console.log("Creating card payment with payload:", JSON.stringify({ ...paymentPayload, creditCard: { ...paymentPayload.creditCard, number: "****", ccv: "***" } }));

    const paymentRes = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentRes.json();
    console.log("Asaas card payment response:", JSON.stringify(paymentData));

    if (!paymentData?.id) {
      const errorMsg = paymentData?.errors?.[0]?.description || "Falha ao processar pagamento";
      return new Response(JSON.stringify({ error: errorMsg, details: paymentData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to pending_payments
    await supabase.from("pending_payments").insert({
      asaas_payment_id: paymentData.id,
      product_id,
      buyer_name,
      buyer_email,
      buyer_cpf: cpfClean,
      amount,
      affiliate_ref: affiliate_ref || null,
      status: paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED" ? "confirmed" : "pending",
    });

    // If payment is confirmed immediately, process the sale
    if (paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED") {
      // Idempotency: check if sale already exists for this payment
      const { data: existingSale } = await supabase
        .from("sales")
        .select("id")
        .eq("payment_id", paymentData.id)
        .maybeSingle();

      if (existingSale) {
        return new Response(JSON.stringify({
          success: true,
          status: "CONFIRMED",
          payment_id: paymentData.id,
          product_title: product.title,
          product_type: product.type,
          file_url: product.file_url,
          amount,
          sale_id: existingSale.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate platform fee (3.89% + R$2.49)
      const platformFee = Math.round(amount * 0.0389 + 249);

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
      }

      // Insert sale
      const { data: sale } = await supabase
        .from("sales")
        .insert({
          product_id,
          producer_id: product.producer_id,
          buyer_id: null,
          affiliate_id: affiliateId,
          amount,
          platform_fee: platformFee,
          payment_provider: "card",
          payment_id: paymentData.id,
          status: "completed",
        })
        .select()
        .single();

      // Create commission if affiliate
      if (sale && affiliateId && product.affiliate_commission > 0) {
        const commissionAmount = Math.round(amount * product.affiliate_commission / 100);
        await supabase.from("commissions").insert({
          sale_id: sale.id,
          affiliate_id: affiliateId,
          amount: commissionAmount,
          status: "pending",
        });
      }

      return new Response(JSON.stringify({
        success: true,
        status: "CONFIRMED",
        payment_id: paymentData.id,
        product_title: product.title,
        product_type: product.type,
        file_url: product.file_url,
        amount,
        sale_id: sale?.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payment is pending (analysis, etc.)
    return new Response(JSON.stringify({
      success: true,
      status: paymentData.status,
      payment_id: paymentData.id,
      product_title: product.title,
      amount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
