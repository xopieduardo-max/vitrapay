import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate producer from JWT
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, description, buyer_name, buyer_cpf, buyer_email } = await req.json();

    if (!amount || !Number.isInteger(amount) || amount < 100) {
      return new Response(JSON.stringify({ error: "Valor mínimo de R$ 1,00" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: "Gateway de pagamento não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Due date: 3 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Create or find Asaas customer
    const cpfClean = (buyer_cpf || "").replace(/\D/g, "");
    let customerId: string | null = null;

    if (cpfClean) {
      const searchRes = await fetch(
        `https://api.asaas.com/v3/customers?cpfCnpj=${cpfClean}`,
        { headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY } }
      );
      const searchData = await searchRes.json();
      if (searchData?.data?.length > 0) {
        customerId = searchData.data[0].id;
      }
    }

    if (!customerId) {
      const customerRes = await fetch("https://api.asaas.com/v3/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify({
          name: buyer_name || "Cliente Avulso",
          email: buyer_email || `avulso+${Date.now()}@vitrapay.com`,
          cpfCnpj: cpfClean || "00000000000",
        }),
      });
      const customerData = await customerRes.json();
      customerId = customerData?.id ?? null;
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: "Não foi possível criar o cliente no gateway" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Pix charge — externalReference identifies it as avulso
    const valueInReais = amount / 100;
    const paymentRes = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: valueInReais,
        dueDate: dueDateStr,
        description: description || "Cobrança avulsa VitraPay",
        externalReference: `avulso|${user.id}`,
      }),
    });

    const paymentData = await paymentRes.json();
    if (!paymentData?.id) {
      console.error("Asaas payment error:", JSON.stringify(paymentData));
      return new Response(JSON.stringify({ error: "Falha ao criar cobrança", details: paymentData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to pending_payments with producer_id and no product_id
    await supabase.from("pending_payments").insert({
      asaas_payment_id: paymentData.id,
      product_id: null,
      producer_id: user.id,
      buyer_name: buyer_name || null,
      buyer_email: buyer_email || null,
      buyer_cpf: cpfClean || null,
      amount,
      status: "pending",
    }).then(({ error: e }: any) => { if (e) console.error("pending_payments insert error:", e); });

    // Get QR Code from Asaas
    const pixRes = await fetch(`https://api.asaas.com/v3/payments/${paymentData.id}/pixQrCode`, {
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
    });
    const pixData = await pixRes.json();

    // Push notification to producer
    try {
      const fmtValue = `R$ ${valueInReais.toFixed(2).replace(".", ",")}`;
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer_id: user.id,
          title: "Pix Avulso Gerado 💰",
          body: `Cobrança de ${fmtValue} criada. Aguardando pagamento.`,
          url: "/finance",
        }),
      });
    } catch (_) { /* non-critical */ }

    return new Response(JSON.stringify({
      success: true,
      payment_id: paymentData.id,
      value: paymentData.value,
      due_date: paymentData.dueDate,
      pix_qr_code: pixData?.encodedImage || null,
      pix_copy_paste: pixData?.payload || null,
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
