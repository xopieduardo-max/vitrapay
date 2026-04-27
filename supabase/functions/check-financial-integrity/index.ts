import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tolerância padrão: R$ 1,00 (100 centavos) — ajustável via query string
const DEFAULT_TOLERANCE_CENTS = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const tolerance = Math.max(
      0,
      parseInt(url.searchParams.get("tolerance") ?? `${DEFAULT_TOLERANCE_CENTS}`, 10) ||
        DEFAULT_TOLERANCE_CENTS,
    );

    // 1) Executar a verificação
    const { data: divergences, error: rpcErr } = await supabase.rpc(
      "check_financial_integrity",
      { p_tolerance_cents: tolerance },
    );

    if (rpcErr) {
      console.error("check_financial_integrity RPC error:", rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const issues = (divergences ?? []) as Array<{
      producer_id: string;
      sales_count: number;
      sales_gross: number;
      expected_net: number;
      recorded_net: number;
      difference: number;
    }>;

    const totalDifferenceCents = issues.reduce(
      (acc, it) => acc + Math.abs(Number(it.difference) || 0),
      0,
    );

    // 2) Registrar resultado no audit log (sempre, mesmo sem divergência)
    const summary = {
      tolerance_cents: tolerance,
      producers_with_divergence: issues.length,
      total_difference_cents: totalDifferenceCents,
      checked_at: new Date().toISOString(),
      top_divergences: issues.slice(0, 10),
    };

    // Buscar admins (usados tanto para o audit log quanto para os pushes)
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    // Usar o primeiro admin como autor do log (admin_id exige uuid válido)
    const systemAuthor = admins?.[0]?.user_id;
    if (systemAuthor) {
      await supabase.from("admin_audit_log").insert({
        admin_id: systemAuthor,
        action: issues.length > 0 ? "financial_integrity_alert" : "financial_integrity_check_ok",
        target_type: "system",
        target_id: "daily_check",
        details: summary,
      });
    }

    // 3) Disparar push para todos os admins quando houver divergência
    let pushSent = 0;
    if (issues.length > 0) {
      const reaisDiff = (totalDifferenceCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      const title = "Alerta de integridade financeira";
      const body =
        `${issues.length} produtor(es) com divergência. ` +
        `Diferença total: ${reaisDiff}.`;

      for (const admin of admins ?? []) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              producer_id: admin.user_id,
              title,
              body,
              url: "/admin/audit",
            }),
          });
          if (res.ok) pushSent++;
          else console.error("send-push failed:", await res.text());
        } catch (e) {
          console.error("send-push error:", e);
        }
      }
    }

    console.log(
      `Integrity check: ${issues.length} divergence(s), total ${totalDifferenceCents}c, ${pushSent} push(es) sent`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        ...summary,
        admin_pushes_sent: pushSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("check-financial-integrity error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
