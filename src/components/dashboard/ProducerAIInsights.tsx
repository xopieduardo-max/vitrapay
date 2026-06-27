import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCcw, TrendingUp, TrendingDown, Minus } from "lucide-react";

type InsightsResponse = {
  insights: string[];
  metrics: {
    revenue_7d_cents: number;
    revenue_prev_7d_cents: number;
    sales_7d: number;
    sales_prev_7d: number;
    conversion_7d: number | null;
    conversion_prev_7d: number | null;
  };
  error?: string;
};

function pctDelta(cur: number, prev: number) {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function DeltaBadge({ cur, prev, suffix = "" }: { cur: number; prev: number; suffix?: string }) {
  const d = pctDelta(cur, prev);
  const Icon = d > 1 ? TrendingUp : d < -1 ? TrendingDown : Minus;
  const tone = d > 1 ? "text-green-500" : d < -1 ? "text-red-500" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
      <Icon className="h-3 w-3" />
      {d > 0 ? "+" : ""}{d.toFixed(1)}%{suffix}
    </span>
  );
}

export function ProducerAIInsights() {
  const { data, isLoading, refetch, isFetching, error } = useQuery<InsightsResponse>({
    queryKey: ["producer-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("producer-insights", { body: {} });
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const m = data?.metrics;

  return (
    <Card className="border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Insights de IA
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} className="h-7 text-xs">
          <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {m && (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Faturamento 7d</p>
              <p className="font-bold mt-0.5">R$ {(m.revenue_7d_cents / 100).toFixed(2)}</p>
              <DeltaBadge cur={m.revenue_7d_cents} prev={m.revenue_prev_7d_cents} />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vendas 7d</p>
              <p className="font-bold mt-0.5">{m.sales_7d}</p>
              <DeltaBadge cur={m.sales_7d} prev={m.sales_prev_7d} />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversão 7d</p>
              <p className="font-bold mt-0.5">{m.conversion_7d !== null ? `${(m.conversion_7d * 100).toFixed(1)}%` : "—"}</p>
              {m.conversion_7d !== null && m.conversion_prev_7d !== null && (
                <DeltaBadge cur={m.conversion_7d} prev={m.conversion_prev_7d} />
              )}
            </div>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Analisando seu desempenho…</p>}
        {error && <p className="text-sm text-red-500">Não foi possível gerar insights agora.</p>}
        {data?.error === "credits_exhausted" && (
          <p className="text-sm text-yellow-500">Créditos de IA esgotados. Adicione créditos em Configurações.</p>
        )}

        {data?.insights && data.insights.length > 0 && (
          <ul className="space-y-2">
            {data.insights.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-foreground/90">{i}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
