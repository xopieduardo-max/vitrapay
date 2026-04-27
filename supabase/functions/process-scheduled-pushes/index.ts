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
          // ATOMIC: insere sale + transactions (credit + fee) + wallet em uma única transação.
          // Se qualquer passo falhar, tudo é revertido — nunca mais cria vendas órfãs.
          const { error: rpcErr } = await supabase.rpc("insert_fake_sale_atomic", {
            p_sale_id: scheduled.id,
            p_product_id: scheduled.product_id,
            p_producer_id: scheduled.producer_id,
            p_amount: scheduled.amount,
            p_platform_fee: scheduled.platform_fee ?? 0,
            p_payment_provider: scheduled.payment_provider,
            p_payment_id: scheduled.payment_id,
            p_sale_date: scheduled.sale_date,
          });

          if (rpcErr) {
            console.error(`Atomic sale insert failed for ${scheduled.id}:`, rpcErr);
            // NÃO marcar como inserted — permite retry no próximo ciclo do cron.
            // Apenas pula para a próxima venda agendada.
            continue;
          }

          // Marcar como processada com sucesso
          await supabase
            .from("scheduled_fake_sales")
            .update({ inserted_at: new Date().toISOString() })
            .eq("id", scheduled.id);

          salesInserted++;
        } catch (e) {
          console.error(`Error processing scheduled sale ${scheduled.id}:`, e);
          // NÃO marcar como inserted — permite retry. Erro inesperado.
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

    // ─── 3. Process scheduled ADMIN PUSHES ───
    const { data: adminPushes } = await supabase
      .from("scheduled_admin_pushes")
      .select("*")
      .is("sent_at", null)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    let adminPushSent = 0;

    if (adminPushes && adminPushes.length > 0) {
      for (const push of adminPushes) {
        try {
          const pushPayload: any = {
            title: push.title,
            body: push.body || "",
            url: push.url || "/dashboard",
          };
          if (push.broadcast) {
            pushPayload.broadcast = true;
          } else if (push.target_user_id) {
            pushPayload.producer_id = push.target_user_id;
          }

          const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(pushPayload),
          });

          if (res.ok) adminPushSent++;
          else console.error(`Admin push send failed for ${push.id}:`, await res.text());

          await supabase
            .from("scheduled_admin_pushes")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", push.id);
        } catch (e) {
          console.error(`Error processing admin push ${push.id}:`, e);
          await supabase
            .from("scheduled_admin_pushes")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", push.id);
        }
      }
    }

    console.log(`Processed ${salesInserted} sales, ${pushSent}/${pending?.length || 0} fake pushes, ${adminPushSent} admin pushes`);

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
