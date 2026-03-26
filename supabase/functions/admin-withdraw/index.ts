import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { amount, pix_key, withdrawal_category } = await req.json();
    if (!amount || amount <= 0) throw new Error("Valor inválido");
    if (!pix_key) throw new Error("Chave PIX é obrigatória");
    const validCategories = ["admin-withdrawal", "admin-service-fee-withdrawal", "admin-withdrawal-fee-withdrawal"];
    const category = validCategories.includes(withdrawal_category) ? withdrawal_category : "admin-withdrawal";

    // Amount is in centavos, convert to reais for Asaas
    const valueInReais = amount / 100;

    // Call Asaas transfer API
    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasKey) throw new Error("ASAAS_API_KEY não configurada");

    const asaasRes = await fetch("https://api.asaas.com/v3/transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasKey,
      },
      body: JSON.stringify({
        value: valueInReais,
        pixAddressKey: pix_key,
        description: `Saque Lucro VitraPay - Admin`,
      }),
    });

    const asaasData = await asaasRes.json();

    if (!asaasRes.ok) {
      console.error("Asaas error:", JSON.stringify(asaasData));
      const errorMsg =
        asaasData.errors?.[0]?.description || "Erro ao processar transferência";
      throw new Error(errorMsg);
    }

    // Log the admin withdrawal in transactions
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient.from("transactions").insert({
      user_id: user.id,
      type: "debit",
      category,
      amount,
      balance_type: "available",
      reference_id: asaasData.id || "admin-withdraw",
      release_date: new Date().toISOString(),
      status: "completed",
    });

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: asaasData.id,
        status: asaasData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-withdraw error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
