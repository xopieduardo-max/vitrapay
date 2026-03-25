import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import AdminProfitWithdrawDialog from "@/components/admin/AdminProfitWithdrawDialog";
import {
  AdminWithdrawHistoryDialog,
  PendingWithdrawalsDetailDialog,
  TotalPaidOutDetailDialog,
  PendingCheckoutsDetailDialog,
} from "@/components/admin/AdminCardDetailDialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CalendarDays,
  Trophy,
  Package,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Period = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

const categoryLabels: Record<string, string> = {
  sale: "Venda",
  commission: "Comissão",
  fee: "Taxa",
  withdrawal: "Saque",
  refund: "Reembolso",
  service_fee: "Taxa Serviço",
  chargeback: "Chargeback",
  med: "MED Pix",
};

const categoryIcons: Record<string, string> = {
  sale: "💰",
  commission: "🤝",
  fee: "🏷️",
  withdrawal: "💸",
  refund: "↩️",
  service_fee: "🧾",
  chargeback: "⚠️",
  med: "🏦",
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

function getDateRange(period: Period, customFrom: string, customTo: string, customTimeFrom: string, customTimeTo: string) {
  const now = new Date();
  let from: Date;
  let to: Date = now;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = new Date(y.getFullYear(), y.getMonth(), y.getDate());
      to = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
      break;
    }
    case "7d":
      from = new Date(now);
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from = new Date(now);
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from = new Date(now);
      from.setDate(from.getDate() - 90);
      break;
    case "custom": {
      if (customFrom) {
        const [y, m, d] = customFrom.split("-").map(Number);
        const [hf, mf] = (customTimeFrom || "00:00").split(":").map(Number);
        from = new Date(y, m - 1, d, hf, mf);
      } else {
        from = new Date(now);
        from.setDate(from.getDate() - 30);
      }
      if (customTo) {
        const [y, m, d] = customTo.split("-").map(Number);
        const [ht, mt] = (customTimeTo || "23:59").split(":").map(Number);
        to = new Date(y, m - 1, d, ht, mt);
      }
      break;
    }
    default:
      from = new Date(now);
      from.setDate(from.getDate() - 30);
  }

  return { from, to };
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("30d");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [customTimeFrom, setCustomTimeFrom] = useState("00:00");
  const [customTimeTo, setCustomTimeTo] = useState("23:59");
  const [txFilter, setTxFilter] = useState("all");
  const [profitDialogOpen, setProfitDialogOpen] = useState(false);

  const dateRange = useMemo(
    () => getDateRange(period, customDateFrom, customDateTo, customTimeFrom, customTimeTo),
    [period, customDateFrom, customDateTo, customTimeFrom, customTimeTo]
  );

  // ── Dialog states ──
  const [adminHistoryOpen, setAdminHistoryOpen] = useState(false);
  const [pendingWdOpen, setPendingWdOpen] = useState(false);
  const [totalPaidOpen, setTotalPaidOpen] = useState(false);
  const [checkoutsOpen, setCheckoutsOpen] = useState(false);

  // ── Data fetching ──
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["admin-all-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      return data || [];
    },
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ["admin-all-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, platform_fee, status, created_at, producer_id, product_id, payment_provider")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1000);
      return data || [];
    },
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, title, cover_url");
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats-v2"],
    queryFn: async () => {
      const [profilesRes, productsRes, salesRes, withdrawalsRes] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("sales").select("amount, platform_fee, status").eq("status", "completed"),
          supabase.from("withdrawals").select("amount, status"),
        ]);

      const sales = salesRes.data || [];
      const totalRevenue = sales.reduce((a, s) => a + s.amount, 0);
      const totalPlatformFees = sales.reduce((a, s) => a + (s.platform_fee || 0), 0);
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

  const { data: adminPendingCheckouts = [] } = useQuery({
    queryKey: ["admin-pending-checkouts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_payments")
        .select("id, amount, buyer_name, buyer_email, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const adminPendingCheckoutsCount = adminPendingCheckouts.length;
  const adminPendingCheckoutsValue = adminPendingCheckouts.reduce((acc: number, p: any) => acc + p.amount, 0);

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

  const productMap = useMemo(() => {
    const map: Record<string, string> = {};
    allProducts.forEach((p) => {
      map[p.id] = p.title;
    });
    return map;
  }, [allProducts]);

  // ── Filtered by date range ──
  const transactions = useMemo(() => {
    return allTransactions.filter((t) => {
      const d = new Date(t.created_at);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [allTransactions, dateRange]);

  const filteredSales = useMemo(() => {
    return allSales.filter((s) => {
      const d = new Date(s.created_at);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [allSales, dateRange]);

  // ── Period KPIs ──
  const periodStats = useMemo(() => {
    const revenue = filteredSales.reduce((a, s) => a + s.amount, 0);
    const fees = filteredSales.reduce((a, s) => a + (s.platform_fee || 0), 0);
    return { revenue, fees, count: filteredSales.length };
  }, [filteredSales]);

  // ── Chart data (daily revenue) ──
  const chartData = useMemo(() => {
    const dayMs = 86400000;
    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to.getTime();
    const days = Math.max(1, Math.ceil((toTime - fromTime) / dayMs));
    const result: { date: string; vendas: number }[] = [];

    for (let i = 0; i < days && i < 90; i++) {
      const d = new Date(fromTime + i * dayMs);
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
  }, [transactions, dateRange]);

  // ── Peak hours chart ──
  const peakHoursData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}h`,
      vendas: 0,
      valor: 0,
    }));

    filteredSales.forEach((s) => {
      const h = new Date(s.created_at).getHours();
      hours[h].vendas += 1;
      hours[h].valor += s.amount;
    });

    const maxVendas = Math.max(...hours.map((h) => h.vendas), 1);

    return hours.map((h) => ({
      ...h,
      valor: h.valor / 100,
      intensity: h.vendas / maxVendas,
    }));
  }, [filteredSales]);

  // ── Top sellers ──
  const topSellers = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredSales.forEach((s) => {
      if (!s.producer_id) return;
      if (!map[s.producer_id]) map[s.producer_id] = { total: 0, count: 0 };
      map[s.producer_id].total += s.amount;
      map[s.producer_id].count += 1;
    });
    return Object.entries(map)
      .map(([id, data]) => ({ id, name: profileMap[id] || "Sem nome", ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredSales, profileMap]);

  // ── Top products ──
  const topProducts = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredSales.forEach((s) => {
      if (!s.product_id) return;
      if (!map[s.product_id]) map[s.product_id] = { total: 0, count: 0 };
      map[s.product_id].total += s.amount;
      map[s.product_id].count += 1;
    });
    return Object.entries(map)
      .map(([id, data]) => ({ id, name: productMap[id] || "Produto removido", ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredSales, productMap]);

  // ── Filtered transactions for table ──
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (txFilter !== "all") list = list.filter((t) => t.category === txFilter);
    return list.slice(0, 50);
  }, [transactions, txFilter]);

  // ── Profit per sale (fee_platform - fee_asaas + service_fee) ──
  const SERVICE_FEE_PER_SALE = 99; // R$ 0.99
  const profitPerSale = useMemo(() => {
    return filteredSales.map((s) => {
      const method = s.payment_provider || "pix";
      const amount = s.amount;
      const platformFee = s.platform_fee || 0;
      let asaasCost = 0;

      if (method === "pix") {
        asaasCost = 199; // R$ 1.99
      } else {
        asaasCost = Math.round(amount * 0.0414 + 49);
      }

      const netProfit = platformFee - asaasCost + SERVICE_FEE_PER_SALE;

      return {
        id: s.id,
        created_at: s.created_at,
        amount,
        platformFee,
        asaasCost,
        serviceFee: SERVICE_FEE_PER_SALE,
        netProfit,
        method,
        producer_id: s.producer_id,
        product_id: s.product_id,
      };
    });
  }, [filteredSales]);

  const totalPlatformProfit = useMemo(() => {
    return profitPerSale.reduce((a, s) => a + s.netProfit, 0);
  }, [profitPerSale]);

  const totalAsaasCost = useMemo(() => {
    return profitPerSale.reduce((a, s) => a + s.asaasCost, 0);
  }, [profitPerSale]);

  const totalPlatformFeePeriod = useMemo(() => {
    return profitPerSale.reduce((a, s) => a + s.platformFee, 0);
  }, [profitPerSale]);

  const totalServiceFees = useMemo(() => {
    return profitPerSale.reduce((a, s) => a + s.serviceFee, 0);
  }, [profitPerSale]);

  // ── Daily profit chart data ──
  const dailyProfitData = useMemo(() => {
    const dayMs = 86400000;
    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to.getTime();
    const days = Math.max(1, Math.ceil((toTime - fromTime) / dayMs));
    const map: Record<string, { fee: number; cost: number; profit: number }> = {};

    for (let i = 0; i < days && i < 90; i++) {
      const key = new Date(fromTime + i * dayMs).toISOString().slice(0, 10);
      map[key] = { fee: 0, cost: 0, profit: 0 };
    }

    profitPerSale.forEach((s) => {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      if (map[key]) {
        map[key].fee += s.platformFee;
        map[key].cost += s.asaasCost;
        map[key].profit += s.netProfit;
      }
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        taxa: v.fee / 100,
        custo: v.cost / 100,
        lucro: v.profit / 100,
      }));
  }, [profitPerSale, dateRange]);

  const alerts = useMemo(() => {
    const items: { message: string; type: "warning" | "info" }[] = [];
    const pending = withdrawals.filter((w) => w.status === "pending").length;
    if (pending > 0)
      items.push({ message: `${pending} saque(s) pendente(s) aguardando aprovação`, type: "warning" });
    const recentSales = allTransactions.filter(
      (t) => t.category === "sale" && t.type === "credit" && new Date(t.created_at) >= new Date(Date.now() - 3600000)
    ).length;
    if (recentSales >= 5)
      items.push({ message: `Alto volume: ${recentSales} vendas na última hora`, type: "info" });
    return items;
  }, [allTransactions, withdrawals]);

  // ── Mutations ──
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
      const { data, error } = await supabase.functions.invoke("process-withdrawal", { body: { withdrawal_id: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "PIX enviado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals-dash"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
    },
  });

  const adminWithdrawals = useMemo(() => {
    return allTransactions
      .filter((t) => t.category === "withdrawal" && t.type === "debit" && t.reference_id?.startsWith("admin"))
      .reduce((a, t) => a + t.amount, 0);
  }, [allTransactions]);

  const netProfit = (stats?.totalPlatformFees ?? 0) - adminWithdrawals;

  // ── KPI Cards ──
  const cards = [
    { label: "Faturamento (período)", desc: "Total bruto faturado no período selecionado", value: fmt(periodStats.revenue), icon: DollarSign, color: "text-primary" },
    { label: "Taxa plataforma (período)", desc: "Total de taxas cobradas dos produtores no período", value: fmt(periodStats.fees), icon: TrendingUp, color: "text-accent" },
    { label: "Vendas (período)", desc: "Quantidade de vendas confirmadas no período", value: String(periodStats.count), icon: ShoppingBag, color: "text-primary" },
    {
      label: "Disponível para saque",
      desc: "Lucro líquido acumulado menos saques já realizados",
      value: fmt(netProfit),
      icon: Banknote,
      color: "text-emerald-500",
      clickable: true,
      onClick: () => setProfitDialogOpen(true),
      hint: "Clique para sacar →",
    },
    {
      label: "Total sacado (admin)",
      desc: "Total já sacado pelo administrador da plataforma",
      value: fmt(adminWithdrawals),
      icon: ArrowDownLeft,
      color: "text-primary",
      clickable: true,
      onClick: () => setAdminHistoryOpen(true),
      hint: "Ver histórico →",
    },
    {
      label: "Saques pendentes (produtores)",
      desc: "Saques solicitados por produtores aguardando aprovação",
      value: fmt(stats?.pendingWithdrawals ?? 0),
      icon: Clock,
      color: "text-warning",
      clickable: true,
      onClick: () => setPendingWdOpen(true),
      hint: "Ver detalhes →",
    },
    {
      label: "Total pago (produtores)",
      desc: "Total de saques pagos aos produtores",
      value: fmt(stats?.totalPaidOut ?? 0),
      icon: Wallet,
      color: "text-accent",
      clickable: true,
      onClick: () => setTotalPaidOpen(true),
      hint: "Ver histórico →",
    },
    {
      label: "Checkouts pendentes",
      desc: "Pagamentos iniciados ainda não confirmados (expiram pelo gateway)",
      value: `${adminPendingCheckoutsCount} • ${fmt(adminPendingCheckoutsValue)}`,
      icon: ShoppingBag,
      color: "text-warning",
      clickable: true,
      onClick: () => setCheckoutsOpen(true),
      hint: "Ver detalhes →",
    },
    { label: "Usuários", desc: "Total de usuários cadastrados", value: String(stats?.totalUsers ?? 0), icon: Users, color: "text-muted-foreground" },
    {
      label: "Margem de lucro média",
      desc: "Percentual médio de lucro sobre taxas cobradas no período",
      value: totalPlatformFeePeriod > 0
        ? `${((totalPlatformProfit / totalPlatformFeePeriod) * 100).toFixed(1)}%`
        : "0%",
      icon: TrendingUp,
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma em tempo real</p>
      </div>

      {/* ── Date/Time Filter ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Filtro por período</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: "today", label: "Hoje" },
            { key: "yesterday", label: "Ontem" },
            { key: "7d", label: "7 dias" },
            { key: "30d", label: "30 dias" },
            { key: "90d", label: "90 dias" },
            { key: "custom", label: "Personalizado" },
          ] as { key: Period; label: string }[]).map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <div className="space-y-1">
              <label className="text-[0.65rem] text-muted-foreground font-medium uppercase">Data início</label>
              <Input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.65rem] text-muted-foreground font-medium uppercase">Hora início</label>
              <Input
                type="time"
                value={customTimeFrom}
                onChange={(e) => setCustomTimeFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.65rem] text-muted-foreground font-medium uppercase">Data fim</label>
              <Input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.65rem] text-muted-foreground font-medium uppercase">Hora fim</label>
              <Input
                type="time"
                value={customTimeTo}
                onChange={(e) => setCustomTimeTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
        <p className="text-[0.6rem] text-muted-foreground">
          Exibindo: {dateRange.from.toLocaleDateString("pt-BR")} {dateRange.from.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {dateRange.to.toLocaleDateString("pt-BR")} {dateRange.to.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
                alert.type === "warning" ? "border-warning/30 bg-warning/5" : "border-primary/30 bg-primary/5"
              }`}
            >
              <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.type === "warning" ? "text-warning" : "text-primary"}`} />
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
              <card.icon className={`h-4 w-4 ${card.color}`} strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            {(card as any).desc && (
              <p className="text-[0.55rem] text-muted-foreground/70 leading-tight">{(card as any).desc}</p>
            )}
            {(card as any).hint && (
              <p className="text-[0.6rem] text-primary/70 mt-1">{(card as any).hint}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Receita por dia</h2>
        </div>
        <div className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
              />
              <Line type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Horários que mais vendem</h2>
        </div>
        <div className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === "vendas") return [value, "Vendas"];
                  return [`R$ ${value.toFixed(2)}`, "Valor"];
                }}
              />
              <Bar dataKey="vendas" radius={[4, 4, 0, 0]}>
                {peakHoursData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={`hsl(var(--primary) / ${0.3 + entry.intensity * 0.7})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Sellers + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Sellers */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <h2 className="text-sm font-semibold">Top Produtores</h2>
          </div>
          {topSellers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma venda no período.</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {topSellers.map((seller, i) => (
                <div
                  key={seller.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                      i === 0 ? "bg-yellow-500/20 text-yellow-600" : i === 1 ? "bg-gray-300/20 text-gray-500" : i === 2 ? "bg-orange-400/20 text-orange-500" : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{seller.name}</p>
                      <p className="text-[0.6rem] text-muted-foreground">{seller.count} venda(s)</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 whitespace-nowrap">{fmt(seller.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Top Produtos</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma venda no período.</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {topProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                      i === 0 ? "bg-yellow-500/20 text-yellow-600" : i === 1 ? "bg-gray-300/20 text-gray-500" : i === 2 ? "bg-orange-400/20 text-orange-500" : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-[0.6rem] text-muted-foreground">{product.count} venda(s)</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 whitespace-nowrap">{fmt(product.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Profit Chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Banknote className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Lucro Líquido por Dia</h2>
        </div>
        <div className="p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyProfitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { taxa: "Taxa cobrada", custo: "Custo gateway", lucro: "Lucro líquido" };
                  return [`R$ ${value.toFixed(2)}`, labels[name] || name];
                }}
              />
              <Bar dataKey="lucro" name="lucro" radius={[4, 4, 0, 0]}>
                {dailyProfitData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.lucro >= 0 ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform Profit Report */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">Lucro Líquido por Transação</h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">Taxa cobrada: <strong className="text-foreground">{fmt(totalPlatformFeePeriod)}</strong></span>
            <span className="text-muted-foreground">Custo gateway: <strong className="text-destructive">{fmt(totalAsaasCost)}</strong></span>
            <span className="text-muted-foreground">Lucro líquido: <strong className={totalPlatformProfit >= 0 ? "text-accent" : "text-destructive"}>{fmt(totalPlatformProfit)}</strong></span>
          </div>
        </div>
        {profitPerSale.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma venda no período.</div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-left px-4 py-2 font-medium">Produtor</th>
                  <th className="text-left px-4 py-2 font-medium">Produto</th>
                  <th className="text-left px-4 py-2 font-medium">Método</th>
                  <th className="text-right px-4 py-2 font-medium">Valor Bruto</th>
                  <th className="text-right px-4 py-2 font-medium">Taxa Cobrada</th>
                  <th className="text-right px-4 py-2 font-medium">Custo Gateway</th>
                  <th className="text-right px-4 py-2 font-medium">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {profitPerSale.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5 truncate max-w-[120px]">{profileMap[s.producer_id || ""] || "—"}</td>
                    <td className="px-4 py-2.5 truncate max-w-[150px]">{productMap[s.product_id || ""] || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[0.6rem] ${s.method === "pix" ? "border-accent/30 text-accent" : "border-primary/30 text-primary"}`}>
                        {s.method === "pix" ? "PIX" : "Cartão"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt(s.amount)}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmt(s.platformFee)}</td>
                    <td className="px-4 py-2.5 text-right text-destructive">{fmt(s.asaasCost)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${s.netProfit >= 0 ? "text-accent" : "text-destructive"}`}>
                      {fmt(s.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma transação encontrada.</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {filteredTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.type === "credit" ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                      {t.type === "credit" ? <ArrowDownLeft className="h-3 w-3 text-emerald-600" /> : <ArrowUpRight className="h-3 w-3 text-destructive" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {categoryIcons[t.category]} {categoryLabels[t.category] || t.category}
                        <span className="text-muted-foreground ml-1.5">— {profileMap[t.user_id] || "—"}</span>
                      </p>
                      <p className="text-[0.6rem] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <p className={`text-xs font-bold whitespace-nowrap ${t.type === "credit" ? "text-emerald-600" : "text-destructive"}`}>
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
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum saque registrado.</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{profileMap[w.user_id] || "Usuário"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[0.6rem] text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</p>
                      <Badge variant="outline" className={`text-[0.55rem] ${withdrawalStatusColors[w.status] || ""}`}>
                        {withdrawalStatusLabels[w.status] || w.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{fmt(w.amount)}</span>
                    {w.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[0.6rem] px-2" onClick={() => approveMutation.mutate(w.id)} disabled={approveMutation.isPending}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" className="h-6 text-[0.6rem] px-2" onClick={() => payPixMutation.mutate(w.id)} disabled={payPixMutation.isPending}>
                          {payPixMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Banknote className="h-3 w-3 mr-1" /> Pagar PIX</>}
                        </Button>
                      </div>
                    )}
                    {w.status === "processing" && (
                      <Button size="sm" className="h-6 text-[0.6rem] px-2" onClick={() => payPixMutation.mutate(w.id)} disabled={payPixMutation.isPending}>
                        {payPixMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Banknote className="h-3 w-3 mr-1" /> Pagar PIX</>}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminProfitWithdrawDialog open={profitDialogOpen} onOpenChange={setProfitDialogOpen} availableProfit={netProfit} />
      <AdminWithdrawHistoryDialog open={adminHistoryOpen} onOpenChange={setAdminHistoryOpen} transactions={allTransactions} totalWithdrawn={adminWithdrawals} />
      <PendingWithdrawalsDetailDialog open={pendingWdOpen} onOpenChange={setPendingWdOpen} withdrawals={withdrawals} profileMap={profileMap} />
      <TotalPaidOutDetailDialog open={totalPaidOpen} onOpenChange={setTotalPaidOpen} withdrawals={withdrawals} profileMap={profileMap} totalPaidOut={stats?.totalPaidOut ?? 0} />
      <PendingCheckoutsDetailDialog open={checkoutsOpen} onOpenChange={setCheckoutsOpen} checkouts={adminPendingCheckouts} />
    </div>
  );
}
