import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// This function releases pending card balances after D+2
// Should be called via a cron job or manually by admin
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find card sales older than 2 days that haven't been released yet
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Get pending card transactions that should be released
    const { data: pendingTxns, error } = await supabase
      .from("transactions")
      .select("id, user_id, amount, category, type")
      .eq("balance_type", "pending")
      .lte("created_at", twoDaysAgo.toISOString());

    if (error) {
      console.error("Error fetching pending transactions:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingTxns || pendingTxns.length === 0) {
      return new Response(JSON.stringify({ released: 0, message: "No pending balances to release" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingTxns.length} pending transactions to release`);

    // Group by user_id and calculate net amounts to move
    const userAmounts: Record<string, number> = {};
    const txnIds: string[] = [];

    for (const txn of pendingTxns) {
      txnIds.push(txn.id);
      const netAmount = txn.type === "credit" ? txn.amount : -txn.amount;
      userAmounts[txn.user_id] = (userAmounts[txn.user_id] || 0) + netAmount;
    }

    // Update each user's wallet: move from pending to available
    let releasedCount = 0;
    for (const [userId, netAmount] of Object.entries(userAmounts)) {
      if (netAmount <= 0) continue;

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance_available, balance_pending")
        .eq("user_id", userId)
        .maybeSingle();

      if (wallet) {
        const newAvailable = Number(wallet.balance_available) + netAmount;
        const newPending = Math.max(0, Number(wallet.balance_pending) - netAmount);

        await supabase.from("wallets").update({
          balance_available: newAvailable,
          balance_pending: newPending,
        }).eq("id", wallet.id);

        console.log(`Released ${netAmount} for user ${userId}: available=${newAvailable}, pending=${newPending}`);
        releasedCount++;
      }
    }

    // Mark transactions as released (change balance_type to available)
    if (txnIds.length > 0) {
      await supabase
        .from("transactions")
        .update({ balance_type: "available" })
        .in("id", txnIds);
    }

    return new Response(
      JSON.stringify({
        released: releasedCount,
        transactions_updated: txnIds.length,
        message: `Released ${releasedCount} user balances`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("release-pending-balances error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
