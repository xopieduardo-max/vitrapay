import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { product_id, buyer_name, buyer_email, buyer_cpf, amount, description } = await req.json();

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
    
    if (buyer_name && buyer_email) {
      // Try to find existing customer by email
      const searchRes = await fetch(
        `https://sandbox.asaas.com/api/v3/customers?email=${encodeURIComponent(buyer_email)}`,
        {
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
        }
      );
      const searchData = await searchRes.json();

      if (searchData?.data?.length > 0) {
        customerId = searchData.data[0].id;
      } else {
        // Create new customer
        const customerRes = await fetch("https://sandbox.asaas.com/api/v3/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
          body: JSON.stringify({
            name: buyer_name || "Cliente VitraPay",
            email: buyer_email || undefined,
            cpfCnpj: buyer_cpf?.replace(/\D/g, "") || undefined,
          }),
        });
        const customerData = await customerRes.json();
        if (customerData?.id) {
          customerId = customerData.id;
        }
      }
    }

    if (!customerId) {
      // Fallback: create minimal customer
      const fallbackRes = await fetch("https://sandbox.asaas.com/api/v3/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          name: buyer_name || "Cliente VitraPay",
          email: buyer_email || "cliente@vitrapay.com",
          cpfCnpj: buyer_cpf?.replace(/\D/g, "") || undefined,
        }),
      });
      const fallbackData = await fallbackRes.json();
      customerId = fallbackData?.id;
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: "Failed to create customer" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        externalReference: product_id,
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentData?.id) {
      console.error("Asaas payment error:", JSON.stringify(paymentData));
      return new Response(JSON.stringify({ error: "Failed to create payment", details: paymentData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
