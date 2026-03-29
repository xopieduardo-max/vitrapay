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

    const { amount, pix_key, pix_key_type, withdrawal_category } = await req.json();

    if (!amount || typeof amount !== "number" || amount <= 0) throw new Error("Valor inválido");
    if (!pix_key || !pix_key.trim()) throw new Error("Chave PIX é obrigatória");

    const validKeyTypes = ["cpf", "cnpj", "email", "phone", "random_key"];
    if (!pix_key_type || !validKeyTypes.includes(pix_key_type)) {
      throw new Error("Tipo de chave PIX inválido. Use: cpf, cnpj, email, phone ou random_key");
    }

    const MAX_ADMIN_WITHDRAW = 1000000; // R$ 10.000,00 por transação
    if (amount > MAX_ADMIN_WITHDRAW) {
      throw new Error("Limite por transação é R$ 10.000,00. Faça múltiplos saques para valores maiores.");
    }

    const validCategories = ["admin-withdrawal", "admin-service-fee-withdrawal", "admin-withdrawal-fee-withdrawal"];
    const category = validCategories.includes(withdrawal_category) ? withdrawal_category : "admin-withdrawal";

    const keyTypeMap: Record<string, string> = {
      cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", phone: "PHONE", random_key: "EVP",
    };

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
        pixAddressKeyType: keyTypeMap[pix_key_type],
        description: `Saque Admin VitraPay - ${user.id}`,
      }),
    });

    const asaasData = await asaasRes.json();

    if (!asaasRes.ok) {
      console.error("Asaas error:", JSON.stringify(asaasData));
      const errorMsg =
        asaasData.errors?.[0]?.description || "Erro ao processar transferência";
      throw new Error(errorMsg);
    }

    // Log the admin withdrawal in transactions (includes admin user_id for audit)
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
      metadata: { admin_id: user.id, pix_key_type, transfer_id: asaasData.id },
    });

    console.log(`Admin withdrawal: admin=${user.id} amount=${amount} key_type=${pix_key_type} transfer=${asaasData.id}`);

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
