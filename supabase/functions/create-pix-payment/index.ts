import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { product_id, buyer_name, buyer_email, buyer_cpf, amount, description, affiliate_ref } = await req.json();

    if (!product_id || !amount || !buyer_cpf) {
      return new Response(JSON.stringify({ error: "Missing required fields (product_id, amount, buyer_cpf)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify product exists and is published
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

    if (!product.is_published) {
      return new Response(JSON.stringify({ error: "Product not available" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate due date (3 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Create customer on Asaas (or use existing)
    let customerId: string | null = null;
    const cpfClean = buyer_cpf?.replace(/\D/g, "") || "";
    
    if (buyer_name && buyer_email) {
      const searchRes = await fetch(
        `https://api.asaas.com/v3/customers?cpfCnpj=${cpfClean}`,
        {
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
        }
      );
      const searchData = await searchRes.json();
      console.log("Asaas customer search response:", JSON.stringify(searchData));
      if (searchData?.data?.length > 0) {
        customerId = searchData.data[0].id;
        await fetch(`https://api.asaas.com/v3/customers/${customerId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
          body: JSON.stringify({
            name: buyer_name,
            email: buyer_email,
            cpfCnpj: cpfClean,
          }),
        });
      } else {
        const customerRes = await fetch("https://sandbox.asaas.com/api/v3/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
          body: JSON.stringify({
            name: buyer_name || "Cliente VitraPay",
            email: buyer_email,
            cpfCnpj: cpfClean,
          }),
        });
        const customerData = await customerRes.json();
        if (customerData?.id) customerId = customerData.id;
      }
    }

    if (!customerId) {
      const fallbackRes = await fetch("https://sandbox.asaas.com/api/v3/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          name: buyer_name || "Cliente VitraPay",
          email: buyer_email || "cliente@vitrapay.com",
          cpfCnpj: cpfClean,
        }),
      });
      const fallbackData = await fallbackRes.json();
      console.log("Asaas customer fallback response:", JSON.stringify(fallbackData));
      customerId = fallbackData?.id;
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: "CPF/CNPJ inválido. Verifique os dados e tente novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Structured externalReference: "product_id|affiliate_ref"
    const externalReference = `${product_id}|${affiliate_ref || ""}`;

    // Create PIX payment
    const valueInReais = amount / 100;
    const paymentRes = await fetch("https://sandbox.asaas.com/api/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: valueInReais,
        dueDate: dueDateStr,
        description: description || `Compra de produto na VitraPay - ${product.title}`,
        externalReference,
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentData?.id) {
      console.error("Asaas payment error:", JSON.stringify(paymentData));
      return new Response(JSON.stringify({ error: "Failed to create payment", details: paymentData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to pending_payments
    const { error: pendingErr } = await supabase.from("pending_payments").insert({
      asaas_payment_id: paymentData.id,
      product_id,
      buyer_name: buyer_name || null,
      buyer_email: buyer_email || null,
      buyer_cpf: cpfClean || null,
      amount,
      affiliate_ref: affiliate_ref || null,
      status: "pending",
    });

    if (pendingErr) {
      console.error("Failed to save pending payment:", pendingErr);
    }

    // Get PIX QR Code
    const pixRes = await fetch(`https://sandbox.asaas.com/api/v3/payments/${paymentData.id}/pixQrCode`, {
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
    });

    const pixData = await pixRes.json();

    return new Response(JSON.stringify({
      success: true,
      payment_id: paymentData.id,
      asaas_payment_id: paymentData.id,
      status: paymentData.status,
      value: paymentData.value,
      due_date: paymentData.dueDate,
      pix_qr_code: pixData?.encodedImage || null,
      pix_copy_paste: pixData?.payload || null,
      product_title: product.title,
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
