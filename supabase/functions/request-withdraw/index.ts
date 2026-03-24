import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTO_APPROVE_LIMIT = 10000; // R$ 100.00 in cents
const MIN_WITHDRAWAL = 1000;      // R$ 10.00 in cents
const WITHDRAWAL_FEE = 500;       // R$ 5.00 in cents
const HOLDBACK_DAYS_CARD = 2;
const HOLDBACK_DAYS_PIX = 0;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, pix_key, pix_key_type } = await req.json();

    // Validations
    if (!amount || typeof amount !== "number" || amount < MIN_WITHDRAWAL) {
      return new Response(JSON.stringify({ error: `Saque mínimo de R$ ${(MIN_WITHDRAWAL / 100).toFixed(2)}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pix_key || !pix_key.trim()) {
      return new Response(JSON.stringify({ error: "Informe a chave Pix" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check profile completeness before allowing withdrawal
    const { data: profileData } = await supabase
      .from("profiles")
      .select("cpf, phone, display_name")
      .eq("user_id", user.id)
      .single();

    if (!profileData?.cpf || !profileData?.phone || !profileData?.display_name) {
      return new Response(JSON.stringify({ error: "Complete seu cadastro (nome, CPF e telefone) em Ajustes antes de solicitar saque" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate balance from wallets table ──
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance_available")
      .eq("user_id", user.id)
      .maybeSingle();

    const availableBalance = wallet ? Number(wallet.balance_available) : 0;

    if (availableBalance <= 0) {
      return new Response(JSON.stringify({ error: "Saldo disponível insuficiente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount + WITHDRAWAL_FEE > availableBalance) {
      return new Response(JSON.stringify({
        error: `Saldo insuficiente. Disponível: R$ ${(availableBalance / 100).toFixed(2)} (saque + taxa de R$ 5,00 = R$ ${((amount + WITHDRAWAL_FEE) / 100).toFixed(2)})`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for pending withdrawals to prevent double-spending
    const { data: pendingWithdrawals } = await supabase
      .from("withdrawals")
      .select("amount")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"]);

    const totalPending = (pendingWithdrawals || []).reduce((acc, w) => acc + w.amount + WITHDRAWAL_FEE, 0);

    if (amount + WITHDRAWAL_FEE + totalPending > availableBalance) {
      return new Response(JSON.stringify({
        error: `Saldo insuficiente considerando saques pendentes (R$ ${(totalPending / 100).toFixed(2)} em processamento)`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create withdrawal record
    const { data: withdrawal, error: insertErr } = await supabase
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount,
        pix_key: pix_key.trim(),
        pix_key_type: pix_key_type || "cpf",
        status: amount <= AUTO_APPROVE_LIMIT ? "processing" : "pending",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert withdrawal error:", insertErr);
      throw new Error("Erro ao criar solicitação de saque");
    }

    // Auto-process if within limit
    if (amount <= AUTO_APPROVE_LIMIT) {
      console.log(`Auto-processing withdrawal ${withdrawal.id}: R$ ${(amount / 100).toFixed(2)}`);

      const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
      if (!asaasApiKey) {
        // Fallback to pending if no API key
        await supabase.from("withdrawals").update({ status: "pending" }).eq("id", withdrawal.id);
        return new Response(JSON.stringify({
          success: true,
          auto_processed: false,
          withdrawal_id: withdrawal.id,
          message: "Saque criado, aguardando aprovação (API key não configurada)",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valueInReais = amount / 100;

      const asaasResponse = await fetch("https://api.asaas.com/v3/transfers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          value: valueInReais,
          pixAddressKey: pix_key.trim(),
          description: `Saque VitraPay #${withdrawal.id.substring(0, 8)}`,
        }),
      });

      const asaasData = await asaasResponse.json();
      console.log("Asaas auto-transfer response:", JSON.stringify(asaasData));

      if (!asaasResponse.ok || asaasData.errors) {
        const errorMsg = asaasData.errors
          ? asaasData.errors.map((e: any) => e.description).join("; ")
          : `HTTP ${asaasResponse.status}`;

        console.error("Asaas auto-transfer failed:", errorMsg);

        // Revert to pending for admin review
        await supabase.from("withdrawals").update({ status: "pending" }).eq("id", withdrawal.id);

        return new Response(JSON.stringify({
          success: true,
          auto_processed: false,
          withdrawal_id: withdrawal.id,
          message: `PIX automático falhou (${errorMsg}). Saque enviado para aprovação manual.`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Success: update withdrawal
      await supabase.from("withdrawals").update({
        transfer_id: asaasData.id,
        status: "completed",
        paid_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      }).eq("id", withdrawal.id);

      // Record withdrawal + fee transactions
      const totalDeducted = amount + WITHDRAWAL_FEE;
      try {
        await supabase.from("transactions").insert([
          {
            user_id: user.id,
            type: "debit",
            category: "withdrawal",
            amount,
            balance_type: "available",
            reference_id: withdrawal.id,
            release_date: new Date().toISOString(),
            status: "completed",
          },
          {
            user_id: user.id,
            type: "debit",
            category: "fee",
            amount: WITHDRAWAL_FEE,
            balance_type: "available",
            reference_id: withdrawal.id,
            release_date: new Date().toISOString(),
            status: "completed",
          },
        ]);
      } catch (txErr) {
        console.error("Auto-withdraw transaction error:", txErr);
      }

      // ── Deduct from wallet ──
      if (wallet) {
        const newAvailable = Math.max(0, Number(wallet.balance_available) - totalDeducted);
        const newTotal = Math.max(0, newAvailable); // balance_total will be recalculated
        await supabase.from("wallets").update({
          balance_available: newAvailable,
          balance_total: newAvailable + (wallet.balance_pending || 0),
        }).eq("id", wallet.id);
        console.log(`Wallet deducted: -${totalDeducted} from available. New available: ${newAvailable}`);
      }

      // Notify producer (email + push)
      try {
        await fetch(`${supabaseUrl}/functions/v1/notify-withdrawal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            amount,
            transfer_id: asaasData.id,
          }),
        });
      } catch (e) {
        console.error("Failed to send withdrawal notification:", e);
      }

      return new Response(JSON.stringify({
        success: true,
        auto_processed: true,
        withdrawal_id: withdrawal.id,
        transfer_id: asaasData.id,
        message: `PIX de R$ ${valueInReais.toFixed(2)} enviado automaticamente!`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Above limit: pending for admin
    return new Response(JSON.stringify({
      success: true,
      auto_processed: false,
      withdrawal_id: withdrawal.id,
      message: `Saque de R$ ${(amount / 100).toFixed(2)} criado. Aguardando aprovação do administrador.`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("request-withdraw error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
