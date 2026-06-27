import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ShoppingBag, UserPlus, Banknote, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function AdminTodayPulse() {
  const todayISO = startOfTodayISO();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-today-pulse"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [salesRes, usersRes, withdrawalsRes, disputesRes] = await Promise.all([
        supabase
          .from("sales")
          .select("amount, payment_id, status, created_at")
          .eq("status", "completed")
          .gte("created_at", todayISO),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayISO),
        supabase
          .from("withdrawals")
          .select("amount, status")
          .in("status", ["pending", "processing"]),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "pending"]),
      ]);

      const realSales = (salesRes.data || []).filter(
        (s: any) => !String(s.payment_id || "").startsWith("fake_")
      );
      const gmv = realSales.reduce((a: number, s: any) => a + (s.amount || 0), 0);
      const salesCount = realSales.length;
      const newUsers = usersRes.count || 0;
      const pendingWds = withdrawalsRes.data || [];
      const pendingWdAmount = pendingWds.reduce((a: number, w: any) => a + w.amount, 0);
      const openTickets = disputesRes.count || 0;

      return {
        gmv,
        salesCount,
        newUsers,
        pendingWdCount: pendingWds.length,
        pendingWdAmount,
        openTickets,
      };
    },
  });

  const items = [
    {
      icon: TrendingUp,
      label: "GMV hoje",
      value: isLoading ? "—" : fmt(data?.gmv || 0),
      sub: isLoading ? "" : `${data?.salesCount || 0} vendas`,
      to: "/admin",
      tone: "primary",
    },
    {
      icon: ShoppingBag,
      label: "Vendas hoje",
      value: isLoading ? "—" : String(data?.salesCount || 0),
      sub: "transações pagas",
      to: "/admin",
      tone: "default",
    },
    {
      icon: UserPlus,
      label: "Novos cadastros",
      value: isLoading ? "—" : String(data?.newUsers || 0),
      sub: "nas últimas 24h",
      to: "/admin/users",
      tone: "default",
    },
    {
      icon: Banknote,
      label: "Saques pendentes",
      value: isLoading ? "—" : String(data?.pendingWdCount || 0),
      sub: isLoading ? "" : fmt(data?.pendingWdAmount || 0),
      to: "/admin/withdrawals",
      tone: (data?.pendingWdCount || 0) > 0 ? "warning" : "default",
    },
    {
      icon: AlertTriangle,
      label: "Chamados abertos",
      value: isLoading ? "—" : String(data?.openTickets || 0),
      sub: "suporte",
      to: "/admin/support",
      tone: (data?.openTickets || 0) > 0 ? "warning" : "default",
    },
  ];

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Hoje na plataforma
            </h3>
            <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground mt-0.5">
              Atualiza a cada 30s
            </p>
          </div>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {items.map((it) => {
            const Icon = it.icon;
            const toneClass =
              it.tone === "warning"
                ? "border-yellow-500/30 bg-yellow-500/[0.04]"
                : it.tone === "primary"
                ? "border-primary/30 bg-primary/[0.05]"
                : "border-border bg-muted/20";
            return (
              <Link
                key={it.label}
                to={it.to}
                className={`group rounded-lg border ${toneClass} p-3 transition hover:border-primary/50 hover:bg-primary/[0.06]`}
              >
                <div className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-widest text-muted-foreground mb-1">
                  <Icon className="h-3 w-3" strokeWidth={1.5} />
                  {it.label}
                </div>
                <div className="text-lg font-bold tracking-tight">{it.value}</div>
                {it.sub && (
                  <div className="text-[0.65rem] text-muted-foreground mt-0.5">{it.sub}</div>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
