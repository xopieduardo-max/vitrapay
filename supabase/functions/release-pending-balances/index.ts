import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Releases pending card balances after their release_date (D+2 or D+30)
// Runs automatically via pg_cron every hour
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Find pending transactions where release_date has passed
    const { data: pendingTxns, error } = await supabase
      .from("transactions")
      .select("id, user_id, amount, category, type")
      .eq("status", "pending")
      .eq("balance_type", "pending")
      .lte("release_date", now);

    if (error) {
      console.error("Error fetching pending transactions:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingTxns || pendingTxns.length === 0) {
      console.log("No pending balances to release");
      return new Response(
        JSON.stringify({ released: 0, message: "No pending balances to release" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingTxns.length} pending transactions to release`);

    // Group net amounts by user_id
    const userAmounts: Record<string, number> = {};
    const txnIds: string[] = [];

    for (const txn of pendingTxns) {
      txnIds.push(txn.id);
      // Credits add to balance, debits (fees) don't affect wallet movement
      // We only move credit amounts from pending → available
      if (txn.type === "credit") {
        userAmounts[txn.user_id] = (userAmounts[txn.user_id] || 0) + txn.amount;
      }
    }

    // Update each user's wallet: move from pending to available
    let releasedCount = 0;
    for (const [userId, amount] of Object.entries(userAmounts)) {
      if (amount <= 0) continue;

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance_available, balance_pending")
        .eq("user_id", userId)
        .maybeSingle();

      if (wallet) {
        const newAvailable = Number(wallet.balance_available) + amount;
        const newPending = Math.max(0, Number(wallet.balance_pending) - amount);

        const { error: updateErr } = await supabase
          .from("wallets")
          .update({
            balance_available: newAvailable,
            balance_pending: newPending,
          })
          .eq("id", wallet.id);

        if (updateErr) {
          console.error(`Failed to update wallet for user ${userId}:`, updateErr);
        } else {
          console.log(
            `Released R$ ${(amount / 100).toFixed(2)} for user ${userId}: ` +
            `available=${newAvailable}, pending=${newPending}`
          );
          releasedCount++;
        }
      } else {
        // Create wallet if somehow missing
        await supabase.from("wallets").insert({
          user_id: userId,
          balance_available: amount,
          balance_pending: 0,
          balance_total: amount,
        });
        console.log(`Created wallet for user ${userId} with released amount: ${amount}`);
        releasedCount++;
      }
    }

    // Mark all processed transactions as completed and available
    if (txnIds.length > 0) {
      const { error: txnUpdateErr } = await supabase
        .from("transactions")
        .update({ balance_type: "available", status: "completed" })
        .in("id", txnIds);

      if (txnUpdateErr) {
        console.error("Failed to update transaction statuses:", txnUpdateErr);
      }
    }

    // Cleanup expired pending_payments (PIX expires in 3 days)
    const expiryThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredPayments, error: expiredErr } = await supabase
      .from("pending_payments")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("created_at", expiryThreshold)
      .select("id");

    if (expiredErr) {
      console.error("Failed to expire pending_payments:", expiredErr);
    } else {
      console.log(`Expired ${expiredPayments?.length ?? 0} stale pending_payments`);
    }

    const result = {
      released: releasedCount,
      transactions_updated: txnIds.length,
      expired_payments: expiredPayments?.length ?? 0,
      message: `Released ${releasedCount} user balances (${txnIds.length} transactions), expired ${expiredPayments?.length ?? 0} payments`,
    };

    console.log("Release complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("release-pending-balances error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
