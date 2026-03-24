import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");

    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    // Verify admin
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { withdrawal_id } = await req.json();

    if (!withdrawal_id) {
      return new Response(JSON.stringify({ error: "withdrawal_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch withdrawal
    const { data: withdrawal, error: fetchErr } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (fetchErr || !withdrawal) {
      return new Response(JSON.stringify({ error: "Withdrawal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent duplicate
    if (withdrawal.transfer_id) {
      return new Response(
        JSON.stringify({ error: "Transfer already processed", transfer_id: withdrawal.transfer_id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (withdrawal.status === "rejected") {
      return new Response(JSON.stringify({ error: "Withdrawal was rejected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!withdrawal.pix_key) {
      return new Response(JSON.stringify({ error: "No PIX key on this withdrawal" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Amount in BRL (stored as centavos)
    const valueInReais = withdrawal.amount / 100;

    console.log(`Processing withdrawal ${withdrawal_id}: R$ ${valueInReais} to PIX ${withdrawal.pix_key}`);

    // Call Asaas Transfer API
    const asaasResponse = await fetch("https://api.asaas.com/v3/transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        value: valueInReais,
        pixAddressKey: withdrawal.pix_key,
        description: `Saque VitraPay #${withdrawal_id.substring(0, 8)}`,
      }),
    });

    const asaasData = await asaasResponse.json();
    console.log("Asaas transfer response:", JSON.stringify(asaasData));

    if (!asaasResponse.ok || asaasData.errors) {
      const errorMsg = asaasData.errors
        ? asaasData.errors.map((e: any) => e.description).join("; ")
        : `HTTP ${asaasResponse.status}`;

      console.error("Asaas transfer error:", errorMsg);

      return new Response(
        JSON.stringify({ error: "Transfer failed", details: errorMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update withdrawal with transfer info
    const { error: updateErr } = await supabase
      .from("withdrawals")
      .update({
        transfer_id: asaasData.id,
        status: "completed",
        paid_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal_id);

    if (updateErr) {
      console.error("Failed to update withdrawal after transfer:", updateErr);
    }

    // Record withdrawal + fee transactions
    const WITHDRAWAL_FEE = 500;
    const totalDeducted = withdrawal.amount + WITHDRAWAL_FEE;

    await supabase.from("transactions").insert([
      {
        user_id: withdrawal.user_id,
        type: "debit",
        category: "withdrawal",
        amount: withdrawal.amount,
        balance_type: "available",
        reference_id: withdrawal_id,
        release_date: new Date().toISOString(),
        status: "completed",
      },
      {
        user_id: withdrawal.user_id,
        type: "debit",
        category: "fee",
        amount: WITHDRAWAL_FEE,
        balance_type: "available",
        reference_id: withdrawal_id,
        release_date: new Date().toISOString(),
        status: "completed",
      },
    ]).catch((err: any) => console.error("Withdrawal transaction error:", err));

    // ── Deduct from wallet ──
    const { data: userWallet } = await supabase
      .from("wallets")
      .select("id, balance_available, balance_pending")
      .eq("user_id", withdrawal.user_id)
      .maybeSingle();

    if (userWallet) {
      const newAvailable = Math.max(0, Number(userWallet.balance_available) - totalDeducted);
      await supabase.from("wallets").update({
        balance_available: newAvailable,
        balance_total: newAvailable + Number(userWallet.balance_pending || 0),
      }).eq("id", userWallet.id);
      console.log(`Admin approval: wallet deducted -${totalDeducted}. New available: ${newAvailable}`);
    }

    // Notify producer (email + push)
    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-withdrawal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: withdrawal.user_id,
          amount: withdrawal.amount,
          transfer_id: asaasData.id,
        }),
      });
    } catch (e) {
      console.error("Failed to send withdrawal notification:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: asaasData.id,
        value: valueInReais,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-withdrawal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
