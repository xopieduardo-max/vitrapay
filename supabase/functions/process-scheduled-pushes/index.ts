import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── 1. Process scheduled fake SALES ───
    const { data: pendingSales, error: salesErr } = await supabase
      .from("scheduled_fake_sales")
      .select("*")
      .is("inserted_at", null)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (salesErr) console.error("Fetch scheduled sales error:", salesErr);

    let salesInserted = 0;

    if (pendingSales && pendingSales.length > 0) {
      for (const scheduled of pendingSales) {
        try {
          // Insert the sale
          const { error: saleErr } = await supabase.from("sales").insert({
            id: scheduled.id,
            product_id: scheduled.product_id,
            producer_id: scheduled.producer_id,
            buyer_id: null,
            affiliate_id: null,
            amount: scheduled.amount,
            platform_fee: scheduled.platform_fee,
            payment_provider: scheduled.payment_provider,
            payment_id: scheduled.payment_id,
            status: "completed",
            created_at: scheduled.sale_date,
          });

          if (saleErr) {
            console.error(`Sale insert error for ${scheduled.id}:`, saleErr);
            // Mark as inserted to avoid infinite retries
            await supabase
              .from("scheduled_fake_sales")
              .update({ inserted_at: new Date().toISOString() })
              .eq("id", scheduled.id);
            continue;
          }

          // Insert pending_payment record
          await supabase.from("pending_payments").insert({
            asaas_payment_id: scheduled.payment_id,
            amount: scheduled.amount,
            status: "confirmed",
            product_id: scheduled.product_id,
            producer_id: scheduled.producer_id,
            buyer_name: "Cliente Simulado",
            buyer_email: `fake_${scheduled.id.slice(0, 6)}@vitrapay.com`,
            created_at: scheduled.sale_date,
          });

          // Insert credit transaction
          const netAmount = scheduled.amount - scheduled.platform_fee;
          await supabase.from("transactions").insert({
            user_id: scheduled.producer_id,
            type: "credit",
            category: "sale",
            amount: netAmount,
            status: "completed",
            balance_type: "available",
            reference_id: scheduled.id,
            created_at: scheduled.sale_date,
          });

          // Insert fee transaction if applicable
          if (scheduled.platform_fee > 0) {
            await supabase.from("transactions").insert({
              user_id: scheduled.producer_id,
              type: "debit",
              category: "fee",
              amount: scheduled.platform_fee,
              status: "completed",
              balance_type: "available",
              reference_id: scheduled.id,
              created_at: scheduled.sale_date,
            });
          }

          // Update wallet
          await supabase.rpc("increment_wallet", {
            p_user_id: scheduled.producer_id,
            p_available_delta: netAmount,
            p_total_delta: netAmount,
          });

          // Mark as inserted
          await supabase
            .from("scheduled_fake_sales")
            .update({ inserted_at: new Date().toISOString() })
            .eq("id", scheduled.id);

          salesInserted++;
        } catch (e) {
          console.error(`Error processing scheduled sale ${scheduled.id}:`, e);
          await supabase
            .from("scheduled_fake_sales")
            .update({ inserted_at: new Date().toISOString() })
            .eq("id", scheduled.id);
        }
      }
    }

    // ─── 2. Process scheduled fake PUSHES ───
    const { data: pending, error: fetchErr } = await supabase
      .from("scheduled_fake_pushes")
      .select("*")
      .is("sent_at", null)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (fetchErr) throw fetchErr;

    let pushSent = 0;

    if (pending && pending.length > 0) {
      for (const push of pending) {
        try {
          const pushUrl = `${supabaseUrl}/functions/v1/send-push`;
          const res = await fetch(pushUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              producer_id: push.producer_id,
              title: push.title,
              body: push.body,
              url: push.url || "/sales",
            }),
          });

          if (res.ok) {
            pushSent++;
          } else {
            console.error(`Push send failed for ${push.id}:`, await res.text());
          }

          await supabase
            .from("scheduled_fake_pushes")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", push.id);
        } catch (e) {
          console.error(`Error processing push ${push.id}:`, e);
          await supabase
            .from("scheduled_fake_pushes")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", push.id);
        }
      }
    }

    console.log(`Processed ${salesInserted} sales, ${pushSent}/${pending?.length || 0} pushes`);

    return new Response(
      JSON.stringify({
        sales_inserted: salesInserted,
        pushes_sent: pushSent,
        pushes_total: pending?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("process-scheduled-pushes error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
