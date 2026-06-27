import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userRes = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userRes.data.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Coleta métricas dos últimos 14 dias
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400_000).toISOString();
    const d14 = new Date(now - 14 * 86400_000).toISOString();

    const [curSales, prevSales, curAttempts, prevAttempts] = await Promise.all([
      supabase.from("sales").select("amount, status, created_at, product_id")
        .eq("producer_id", user.id).gte("created_at", d7),
      supabase.from("sales").select("amount, status, created_at, product_id")
        .eq("producer_id", user.id).gte("created_at", d14).lt("created_at", d7),
      supabase.from("pending_payments").select("status, created_at")
        .eq("producer_id", user.id).gte("created_at", d7),
      supabase.from("pending_payments").select("status, created_at")
        .eq("producer_id", user.id).gte("created_at", d14).lt("created_at", d7),
    ]);

    const sum = (rows: any[] | null) =>
      (rows || [])
        .filter((s) => s.status === "completed")
        .reduce((acc, s) => acc + (s.amount || 0), 0);
    const count = (rows: any[] | null) =>
      (rows || []).filter((s) => s.status === "completed").length;
    const conv = (att: any[] | null) => {
      if (!att || att.length === 0) return null;
      return att.filter((a) => a.status === "confirmed").length / att.length;
    };

    const metrics = {
      revenue_7d_cents: sum(curSales.data as any[]),
      revenue_prev_7d_cents: sum(prevSales.data as any[]),
      sales_7d: count(curSales.data as any[]),
      sales_prev_7d: count(prevSales.data as any[]),
      conversion_7d: conv(curAttempts.data as any[]),
      conversion_prev_7d: conv(prevAttempts.data as any[]),
      checkout_attempts_7d: curAttempts.data?.length || 0,
      abandoned_pix_7d: (curAttempts.data || []).filter((p: any) => p.status === "pending").length,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ insights: ["Configure a IA da plataforma para receber análises."], metrics }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um consultor de e-commerce digital brasileiro. Analise os números abaixo de um produtor digital nos últimos 7 dias vs 7 dias anteriores e gere 3 a 4 insights curtos, diretos e acionáveis, em português, no formato de bullets curtos (uma frase cada). Foque no que mudou, possíveis causas e o que fazer. Não use markdown, não use emojis, não repita os números. Métricas em centavos: ${JSON.stringify(metrics)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (aiRes.status === 429 || aiRes.status === 402) {
      return new Response(
        JSON.stringify({
          error: aiRes.status === 402 ? "credits_exhausted" : "rate_limited",
          metrics,
        }),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const text: string = aiJson?.choices?.[0]?.message?.content ?? "";
    const insights = text
      .split("\n")
      .map((l) => l.replace(/^[-•*\d.\s]+/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 5);

    return new Response(JSON.stringify({ insights, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
