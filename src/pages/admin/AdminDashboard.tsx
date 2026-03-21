import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import AdminProfitWithdrawDialog from "@/components/admin/AdminProfitWithdrawDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Clock,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Loader2,
  CheckCircle2,
  Banknote,
  Filter,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "7d" | "30d" | "90d";

const categoryLabels: Record<string, string> = {
  sale: "Venda",
  commission: "Comissão",
  fee: "Taxa",
  withdrawal: "Saque",
  refund: "Reembolso",
};

const categoryIcons: Record<string, string> = {
  sale: "💰",
  commission: "🤝",
  fee: "🏷️",
  withdrawal: "💸",
  refund: "↩️",
};

const withdrawalStatusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-accent/10 text-accent border-accent/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const withdrawalStatusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  completed: "Pago",
  rejected: "Rejeitado",
};

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chartPeriod, setChartPeriod] = useState<Period>("30d");
  const [txFilter, setTxFilter] = useState("all");
  const [profitDialogOpen, setProfitDialogOpen] = useState(false);

  // ── Data fetching ──
  const { data: transactions = [] } = useQuery({
    queryKey: ["admin-all-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats-v2"],
    queryFn: async () => {
      const [profilesRes, productsRes, salesRes, withdrawalsRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("sales")
            .select("amount, platform_fee, status, created_at")
            .eq("status", "completed"),
          supabase.from("withdrawals").select("amount, status"),
        ]);

      const sales = salesRes.data || [];
      const totalRevenue = sales.reduce((a, s) => a + s.amount, 0);
      const totalPlatformFees = sales.reduce(
        (a, s) => a + (s.platform_fee || 0),
        0
      );
      const wds = withdrawalsRes.data || [];
      const pendingWithdrawals = wds
        .filter((w) => w.status === "pending" || w.status === "processing")
        .reduce((a, w) => a + w.amount, 0);
      const totalPaidOut = wds
        .filter((w) => w.status === "completed")
        .reduce((a, w) => a + w.amount, 0);

      return {
        totalUsers: profilesRes.count || 0,
        totalProducts: productsRes.count || 0,
        totalSales: sales.length,
        totalRevenue,
        totalPlatformFees,
        pendingWithdrawals,
        totalPaidOut,
      };
    },
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["admin-withdrawals-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name");
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => {
      map[p.user_id] = p.display_name || "Sem nome";
    });
    return map;
  }, [profiles]);

  // ── Chart data ──
  const chartData = useMemo(() => {
    const days = chartPeriod === "7d" ? 7 : chartPeriod === "30d" ? 30 : 90;
    const now = new Date();
    const result: { date: string; vendas: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, vendas: 0 });
    }

    transactions
      .filter((t) => t.category === "sale" && t.type === "credit")
      .forEach((t) => {
        const key = new Date(t.created_at).toISOString().slice(0, 10);
        const entry = result.find((r) => r.date === key);
        if (entry) entry.vendas += t.amount;
      });

    return result.map((r) => ({
      ...r,
      vendas: r.vendas / 100,
      label: new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
    }));
  }, [transactions, chartPeriod]);

  // ── Filtered transactions ──
  const filteredTransactions = useMemo(() => {
    if (txFilter === "all") return transactions.slice(0, 50);
    return transactions.filter((t) => t.category === txFilter).slice(0, 50);
  }, [transactions, txFilter]);

  // ── Alerts ──
  const alerts = useMemo(() => {
    const items: { message: string; type: "warning" | "info" }[] = [];
    const pending = withdrawals.filter((w) => w.status === "pending").length;
    if (pending > 0)
      items.push({
        message: `${pending} saque(s) pendente(s) aguardando aprovação`,
        type: "warning",
      });

    const recentSales = transactions.filter(
      (t) =>
        t.category === "sale" &&
        t.type === "credit" &&
        new Date(t.created_at) >=
          new Date(Date.now() - 60 * 60 * 1000)
    ).length;
    if (recentSales >= 5)
      items.push({
        message: `Alto volume: ${recentSales} vendas na última hora`,
        type: "info",
      });

    const refunds = transactions.filter(
      (t) =>
        t.category === "refund" &&
        new Date(t.created_at) >=
          new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    if (refunds > 0)
      items.push({
        message: `${refunds} reembolso(s) nas últimas 24h`,
        type: "warning",
      });

    return items;
  }, [transactions, withdrawals]);

  // ── Approve withdrawal ──
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("withdrawals")
        .update({ status: "processing", processed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saque aprovado" });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals-dash"] });
    },
  });

  const payPixMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "process-withdrawal",
        { body: { withdrawal_id: id } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "PIX enviado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals-dash"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao processar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Calculate net profit (platform fees - admin withdrawals)
  const adminWithdrawals = useMemo(() => {
    return transactions
      .filter((t) => t.category === "withdrawal" && t.type === "debit" && t.reference_id?.startsWith("admin"))
      .reduce((a, t) => a + t.amount, 0);
  }, [transactions]);

  const netProfit = (stats?.totalPlatformFees ?? 0) - adminWithdrawals;

  // ── KPI Cards ──
  const cards = [
    {
      label: "Faturamento total",
      value: fmt(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      color: "text-primary",
    },
    {
      label: "Receita da plataforma",
      value: fmt(stats?.totalPlatformFees ?? 0),
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      label: "Lucro líquido",
      value: fmt(netProfit),
      icon: Banknote,
      color: "text-emerald-500",
      clickable: true,
      onClick: () => setProfitDialogOpen(true),
    },
    {
      label: "Total vendas",
      value: String(stats?.totalSales ?? 0),
      icon: ShoppingBag,
      color: "text-primary",
    },
    {
      label: "Usuários",
      value: String(stats?.totalUsers ?? 0),
      icon: Users,
      color: "text-muted-foreground",
    },
    {
      label: "Saques pendentes",
      value: fmt(stats?.pendingWithdrawals ?? 0),
      icon: Clock,
      color: "text-warning",
    },
    {
      label: "Total pago",
      value: fmt(stats?.totalPaidOut ?? 0),
      icon: Wallet,
      color: "text-accent",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dashboard Financeiro
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da plataforma em tempo real
        </p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                alert.type === "warning"
                  ? "border-warning/30 bg-warning/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 shrink-0 ${
                  alert.type === "warning"
                    ? "text-warning"
                    : "text-primary"
                }`}
              />
              <p className="text-sm">{alert.message}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={(card as any).onClick}
            className={`rounded-xl border border-border bg-card p-4 space-y-1 ${
              (card as any).clickable
                ? "cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all ring-1 ring-primary/20"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <card.icon
                className={`h-4 w-4 ${card.color}`}
                strokeWidth={1.5}
              />
              <span className="text-xs text-muted-foreground">
                {card.label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            {(card as any).clickable && (
              <p className="text-[0.6rem] text-primary/70 mt-1">
                Clique para sacar →
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Receita por dia</h2>
          </div>
          <div className="flex gap-1">
            {(["7d", "30d", "90d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  chartPeriod === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval={chartPeriod === "7d" ? 0 : "preserveStartEnd"}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [
                  `R$ ${value.toFixed(2)}`,
                  "Vendas",
                ]}
              />
              <Line
                type="monotone"
                dataKey="vendas"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two columns: Transactions + Withdrawals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Transactions Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Transações recentes</h2>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={txFilter} onValueChange={setTxFilter}>
                <SelectTrigger className="w-[120px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="sale">Vendas</SelectItem>
                  <SelectItem value="commission">Comissões</SelectItem>
                  <SelectItem value="fee">Taxas</SelectItem>
                  <SelectItem value="withdrawal">Saques</SelectItem>
                  <SelectItem value="refund">Reembolsos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma transação encontrada.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {filteredTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        t.type === "credit"
                          ? "bg-emerald-500/10"
                          : "bg-destructive/10"
                      }`}
                    >
                      {t.type === "credit" ? (
                        <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {categoryIcons[t.category]}{" "}
                        {categoryLabels[t.category] || t.category}
                        <span className="text-muted-foreground ml-1.5">
                          — {profileMap[t.user_id] || "—"}
                        </span>
                      </p>
                      <p className="text-[0.6rem] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-xs font-bold whitespace-nowrap ${
                      t.type === "credit"
                        ? "text-emerald-600"
                        : "text-destructive"
                    }`}
                  >
                    {t.type === "credit" ? "+" : "-"} {fmt(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Withdrawals Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Saques</h2>
          </div>
          {withdrawals.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum saque registrado.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium">
                      {profileMap[w.user_id] || "Usuário"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[0.6rem] text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[0.55rem] ${
                          withdrawalStatusColors[w.status] || ""
                        }`}
                      >
                        {withdrawalStatusLabels[w.status] || w.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{fmt(w.amount)}</span>
                    {w.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[0.6rem] px-2"
                          onClick={() => approveMutation.mutate(w.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 text-[0.6rem] px-2"
                          onClick={() => payPixMutation.mutate(w.id)}
                          disabled={payPixMutation.isPending}
                        >
                          {payPixMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Banknote className="h-3 w-3 mr-1" />
                              Pagar PIX
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    {w.status === "processing" && (
                      <Button
                        size="sm"
                        className="h-6 text-[0.6rem] px-2"
                        onClick={() => payPixMutation.mutate(w.id)}
                        disabled={payPixMutation.isPending}
                      >
                        {payPixMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Banknote className="h-3 w-3 mr-1" />
                            Pagar PIX
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminProfitWithdrawDialog
        open={profitDialogOpen}
        onOpenChange={setProfitDialogOpen}
        availableProfit={netProfit}
      />
    </div>
  );
}
