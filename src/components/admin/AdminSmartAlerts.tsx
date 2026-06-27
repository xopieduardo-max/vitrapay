import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingDown, Wallet, RefreshCcw, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Alert = {
  id: string;
  severity: "high" | "medium" | "low";
  icon: any;
  title: string;
  detail: string;
  href?: string;
};

async function buildAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Produtos com taxa de reembolso/chargeback > 5%
  const { data: salesAgg } = await supabase
    .from("sales")
    .select("product_id, status")
    .gte("created_at", since);

  if (salesAgg && salesAgg.length > 0) {
    const byProduct: Record<string, { total: number; bad: number }> = {};
    for (const s of salesAgg as any[]) {
      const pid = s.product_id;
      if (!pid) continue;
      byProduct[pid] ||= { total: 0, bad: 0 };
      byProduct[pid].total++;
      if (["refunded", "chargeback", "disputed"].includes(s.status)) {
        byProduct[pid].bad++;
      }
    }
    for (const [pid, agg] of Object.entries(byProduct)) {
      if (agg.total >= 10 && agg.bad / agg.total > 0.05) {
        const { data: prod } = await supabase
          .from("products")
          .select("title")
          .eq("id", pid)
          .maybeSingle();
        alerts.push({
          id: `refund-${pid}`,
          severity: "high",
          icon: RefreshCcw,
          title: `Pico de reembolso: ${prod?.title || "produto"}`,
          detail: `${((agg.bad / agg.total) * 100).toFixed(1)}% de reembolso/chargeback nos últimos 30 dias (${agg.bad}/${agg.total}).`,
          href: `/admin/products/${pid}`,
        });
      }
    }
  }

  // 2) Produtores sem PIX com saldo > R$ 50
  const { data: wallets } = await supabase
    .from("wallets")
    .select("user_id, balance_available")
    .gt("balance_available", 5000)
    .limit(500);

  if (wallets && wallets.length > 0) {
    const userIds = (wallets as any[]).map((w) => w.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, pix_key")
      .in("user_id", userIds);
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
    for (const w of wallets as any[]) {
      const p: any = profMap.get(w.user_id);
      if (!p) continue;
      if (!p.pix_key || p.pix_key.trim().length === 0) {
        alerts.push({
          id: `no-pix-${w.user_id}`,
          severity: "medium",
          icon: Wallet,
          title: `Sem PIX: ${p.display_name || "Usuário"}`,
          detail: `Saldo disponível R$ ${(w.balance_available / 100).toFixed(2)} mas sem chave PIX cadastrada.`,
          href: `/admin/users/${w.user_id}`,
        });
      }
    }
  }

  // 3) Queda na taxa de aprovação (7d vs 7d anterior)
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400_000).toISOString();
  const d14 = new Date(now - 14 * 86400_000).toISOString();
  const [{ data: cur }, { data: prev }] = await Promise.all([
    supabase.from("pending_payments").select("status").gte("created_at", d7),
    supabase
      .from("pending_payments")
      .select("status")
      .gte("created_at", d14)
      .lt("created_at", d7),
  ]);
  const rate = (rows: any[] | null) => {
    if (!rows || rows.length === 0) return null;
    const ok = rows.filter((r) => r.status === "confirmed").length;
    return ok / rows.length;
  };
  const rCur = rate(cur as any[]);
  const rPrev = rate(prev as any[]);
  if (rCur !== null && rPrev !== null && rPrev > 0 && rCur < rPrev * 0.8) {
    alerts.push({
      id: "approval-drop",
      severity: "high",
      icon: TrendingDown,
      title: "Taxa de aprovação caindo",
      detail: `Aprovação ${(rCur * 100).toFixed(1)}% nos últimos 7 dias vs ${(rPrev * 100).toFixed(1)}% na semana anterior.`,
      href: "/admin",
    });
  }

  return alerts;
}

export function AdminSmartAlerts() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-smart-alerts"],
    queryFn: buildAlerts,
    refetchInterval: 5 * 60 * 1000,
  });

  const alerts = data || [];

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Alertas inteligentes
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-1">{alerts.length}</Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 text-xs"
        >
          <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Analisando plataforma…</p>}
        {!isLoading && alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum alerta no momento. Tudo saudável. ✓</p>
        )}
        {alerts.map((a) => {
          const Icon = a.icon;
          const tone =
            a.severity === "high"
              ? "border-red-500/40 bg-red-500/5"
              : a.severity === "medium"
                ? "border-yellow-500/40 bg-yellow-500/5"
                : "border-border bg-muted/30";
          const inner = (
            <div className={`flex items-start gap-3 rounded-lg border p-3 ${tone} transition-colors hover:bg-muted/40`}>
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
              </div>
              {a.severity === "high" && (
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              )}
            </div>
          );
          return a.href ? (
            <Link key={a.id} to={a.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={a.id}>{inner}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
