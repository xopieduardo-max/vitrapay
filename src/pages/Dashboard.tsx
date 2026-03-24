import { useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  Zap,
  CreditCard,
  QrCode,
  ChevronRight,
  Calendar as CalendarIcon,
  Flame,
  HelpCircle,
  Users,
  ExternalLink,
  Package,
  BarChart3,
  ArrowDownToLine,
  TrendingUp,
  Clock,
  RefreshCcw,
  ShoppingCart,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import dashboardBanner from "@/assets/dashboard-banner.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REVENUE_GOAL = 1000000;

const paymentMethods = [
  { name: "Cartão de crédito", key: "card", icon: CreditCard },
  { name: "Pix", key: "pix", icon: QrCode },
];

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 10 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.4, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "all" | "custom";

const periodLabels: Record<PeriodKey, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "7 dias",
  "30d": "30 dias",
  all: "Tudo",
  custom: "Personalizado",
};

function getDateRange(period: PeriodKey, customFrom?: Date, customTo?: Date): { from: Date | null; to: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = now;

  switch (period) {
    case "today":
      return { from: todayStart, to };
    case "yesterday": {
      const yStart = new Date(todayStart);
      yStart.setDate(yStart.getDate() - 1);
      return { from: yStart, to: todayStart };
    }
    case "7d": {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - 7);
      return { from: d, to };
    }
    case "30d": {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - 30);
      return { from: d, to };
    }
    case "all":
      return { from: null, to };
    case "custom":
      return { from: customFrom || todayStart, to: customTo || now };
    default:
      return { from: null, to };
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [chartPeriod, setChartPeriod] = useState("30d");
  const [showValues, setShowValues] = useState(true);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ["dashboard-sales", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("amount, platform_fee, status, created_at, payment_provider")
        .eq("producer_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["dashboard-withdrawals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("withdrawals")
        .select("amount, status")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["dashboard-products", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("products")
        .select("id, title")
        .eq("producer_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const productIds = products.map(p => p.id);
  const { data: pendingCheckouts = [] } = useQuery({
    queryKey: ["dashboard-pending-checkouts", user?.id, productIds],
    queryFn: async () => {
      if (!user || productIds.length === 0) return [];
      const { data } = await supabase
        .from("pending_payments")
        .select("amount")
        .in("product_id", productIds)
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!user && productIds.length > 0,
    refetchInterval: 30000,
  });

  // All checkout initiations (all statuses) for conversion rate
  const { data: allCheckouts = [] } = useQuery({
    queryKey: ["dashboard-all-checkouts", user?.id, productIds],
    queryFn: async () => {
      if (!user || productIds.length === 0) return [];
      const { data } = await supabase
        .from("pending_payments")
        .select("status, created_at")
        .in("product_id", productIds);
      return data || [];
    },
    enabled: !!user && productIds.length > 0,
  });

  // Date range from period filter
  const dateRange = useMemo(() => getDateRange(period, customFrom, customTo), [period, customFrom, customTo]);

  // Filter sales by selected period
  const filteredSales = useMemo(() => {
    return salesData.filter((s) => {
      const d = new Date(s.created_at);
      if (dateRange.from && d < dateRange.from) return false;
      if (d > dateRange.to) return false;
      return true;
    });
  }, [salesData, dateRange]);

  const completedSalesAll = salesData.filter((s) => s.status === "completed");
  const completedSales = filteredSales.filter((s) => s.status === "completed");
  const totalRevenue = completedSales.reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);
  const salesCount = completedSales.length;

  const pendingCheckoutsCount = pendingCheckouts.length;
  const pendingCheckoutsValue = pendingCheckouts.reduce((acc, p) => acc + p.amount, 0);
  const pendingSales = filteredSales.filter((s) => s.status === "pending").reduce((acc, s) => acc + s.amount, 0);
  const totalWithdrawn = withdrawals.filter((w) => w.status === "completed").reduce((acc, w) => acc + w.amount, 0);
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending" || w.status === "processing").reduce((acc, w) => acc + w.amount, 0);

  // Available balance (global, not period-filtered)
  const HOLDBACK_DAYS_CARD = 2;
  const HOLDBACK_DAYS_PIX = 0;
  const WITHDRAWAL_FEE = 500;
  const now = new Date();

  const totalAvailableSales = completedSalesAll
    .filter((s) => {
      const holdDays = s.payment_provider === "pix" ? HOLDBACK_DAYS_PIX : HOLDBACK_DAYS_CARD;
      const availableAt = new Date(s.created_at);
      availableAt.setDate(availableAt.getDate() + holdDays);
      return availableAt <= now;
    })
    .reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);

  const totalFeesPaid = withdrawals.filter((w) => w.status !== "rejected").length * WITHDRAWAL_FEE;
  const availableBalance = totalAvailableSales - totalWithdrawn - pendingWithdrawals - totalFeesPaid;
  const ticketMedio = salesCount > 0 ? totalRevenue / salesCount : 0;
  const refundedSales = filteredSales.filter((s) => s.status === "refunded");
  const refundRate = filteredSales.length > 0 ? ((refundedSales.length / filteredSales.length) * 100).toFixed(1) : "0";
  const refundAmount = refundedSales.reduce((acc, s) => acc + s.amount, 0);
  const abandonedSales = filteredSales.filter((s) => s.status === "abandoned").length;

  // Checkout conversion rate
  const filteredCheckouts = useMemo(() => {
    return allCheckouts.filter((c) => {
      const d = new Date(c.created_at);
      if (dateRange.from && d < dateRange.from) return false;
      if (d > dateRange.to) return false;
      return true;
    });
  }, [allCheckouts, dateRange]);
  const totalCheckoutInitiations = filteredCheckouts.length + salesCount; // checkouts + completed sales = total visitors who initiated
  const checkoutConversionRate = totalCheckoutInitiations > 0
    ? ((salesCount / totalCheckoutInitiations) * 100).toFixed(1)
    : "0";
  const checkoutConversionColor = parseFloat(checkoutConversionRate) >= 3 ? "text-primary" : parseFloat(checkoutConversionRate) >= 1 ? "text-warning" : "text-destructive";

  const revenueProgress = Math.min((totalRevenue / REVENUE_GOAL) * 100, 100);

  // Achievement level (global)
  const totalRevenueAll = completedSalesAll.reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);
  const level = totalRevenueAll >= 10000000 ? "Diamante" : totalRevenueAll >= 5000000 ? "Ouro" : totalRevenueAll >= 1000000 ? "Prata" : "Explorador";
  const levelIcon = totalRevenueAll >= 10000000 ? "💎" : totalRevenueAll >= 5000000 ? "🥇" : totalRevenueAll >= 1000000 ? "🥈" : "🧭";
  const nextLevel = totalRevenueAll >= 10000000 ? "Máximo" : totalRevenueAll >= 5000000 ? "Diamante" : totalRevenueAll >= 1000000 ? "Ouro" : "Prata";

  // Sales by provider (period-filtered)
  const salesByProvider = completedSales.reduce<Record<string, { count: number; amount: number }>>((acc, s) => {
    const provider = s.payment_provider || "Outro";
    if (!acc[provider]) acc[provider] = { count: 0, amount: 0 };
    acc[provider].count += 1;
    acc[provider].amount += s.amount - (s.platform_fee || 0);
    return acc;
  }, {});

  // Health score
  const healthScore = Math.max(0, 10 - Math.round(parseFloat(refundRate) * 0.5) - abandonedSales * 0.1);
  const healthColor = healthScore >= 8 ? "text-primary" : healthScore >= 5 ? "text-warning" : "text-destructive";

  const fmt = (v: number) => showValues
    ? `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "R$ •••••";

  const fmtShort = (v: number) => {
    if (!showValues) return "R$ •••••";
    const val = v / 100;
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)}K`;
    return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Produtor";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const chartBars = useMemo(() => {
    if (completedSalesAll.length === 0) return Array.from({ length: 10 }).map(() => 5);
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    completedSalesAll.forEach((s) => {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      if (key in days) days[key] += s.amount - (s.platform_fee || 0);
    });
    const vals = Object.values(days);
    const max = Math.max(...vals, 1);
    return vals.map((v) => Math.max((v / max) * 95, 5));
  }, [completedSalesAll]);

  const quickLinks = [
    { label: "Minhas Vendas", icon: BarChart3, path: "/sales" },
    { label: "Meus Produtos", icon: Package, path: "/products" },
    { label: "Afiliados", icon: Users, path: "/affiliates" },
    { label: "Suporte", icon: HelpCircle, path: "/help" },
  ];

  const handlePeriodChange = (p: PeriodKey) => {
    if (p === "custom") {
      setShowCustomPicker(true);
      setPeriod("custom");
    } else {
      setShowCustomPicker(false);
      setPeriod(p);
    }
  };

  const periodFilterButtons = (
    <div className="flex flex-wrap items-center gap-1.5">
      {(Object.keys(periodLabels) as PeriodKey[]).map((p) => (
        <button
          key={p}
          onClick={() => handlePeriodChange(p)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            period === p
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  );

  const customDatePickers = period === "custom" && (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {customFrom ? format(customFrom, "dd/MM/yyyy") : "De"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={customFrom}
            onSelect={setCustomFrom}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted-foreground">até</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {customTo ? format(customTo, "dd/MM/yyyy") : "Até"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={customTo}
            onSelect={setCustomTo}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      
      {/* Promotional Banner */}
      <motion.div {...anim(0)} className="rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity">
        <img
          src={dashboardBanner}
          alt="Banner promocional VitraPay"
          className="w-full h-auto object-cover rounded-xl"
          style={{ maxHeight: 160 }}
          loading="lazy"
          decoding="async"
        />
      </motion.div>

      {/* ═══════ MOBILE LAYOUT ═══════ */}
      <div className="md:hidden space-y-4">
        {/* Date + Eye toggle */}
        <motion.div {...anim(0)} className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span className="capitalize text-xs">{today}</span>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[110px] h-7 bg-card border-border text-[0.65rem]">
                <SelectValue placeholder="Todos os..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os...</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setShowValues(!showValues)}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              {showValues ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </motion.div>

        {/* Period filter mobile */}
        <motion.div {...anim(0.02)}>
          {periodFilterButtons}
          {customDatePickers}
        </motion.div>

        {/* Greeting */}
        <motion.div {...anim(0.05)} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Olá,</p>
          <h2 className="text-lg font-bold mt-0.5">{displayName} 👋</h2>
          <p className="text-[0.7rem] text-muted-foreground mt-0.5">
            Pequenas ações geram grandes resultados
          </p>
        </motion.div>

        {/* ✨ FATURAMENTO CARD */}
        <motion.div
          {...anim(0.1)}
          className="rounded-xl border-2 border-primary/40 bg-card p-5 shimmer-gold animate-pulse-glow-primary"
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Zap className="h-6 w-6 text-primary" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-primary/80 font-medium">Faturamento • {periodLabels[period]}</p>
              <p className="text-xl font-bold text-primary tracking-tight">
                {fmtShort(totalRevenue)} <span className="text-sm font-normal text-muted-foreground">/ {fmtShort(REVENUE_GOAL)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 relative z-10">
            <div className="flex-1 h-2 rounded-full bg-primary/15 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${revenueProgress}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
              />
            </div>
            <span className="text-xs font-bold text-primary/70">{revenueProgress.toFixed(1)}%</span>
          </div>
        </motion.div>

        {/* Saldo + Total de Vendas */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            {...anim(0.15)}
            className="rounded-xl border border-primary/30 bg-card p-4 space-y-3"
          >
            <p className="text-[0.65rem] text-muted-foreground font-medium">Saldo disponível</p>
            <p className="text-lg font-bold">{fmt(availableBalance)}</p>
            <Button
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => navigate("/finance")}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> Solicitar saque
            </Button>
          </motion.div>
          <motion.div
            {...anim(0.18)}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <p className="text-[0.65rem] text-muted-foreground font-medium">Total de vendas</p>
            <p className="text-lg font-bold">{salesCount}</p>
            <p className="text-[0.55rem] text-muted-foreground">Período: {periodLabels[period]}</p>
          </motion.div>
        </div>

        {/* Ticket médio + Reembolso */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div {...anim(0.2)} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[0.65rem] text-muted-foreground font-medium">Ticket médio</p>
            <p className="text-lg font-bold">{fmt(ticketMedio)}</p>
            <p className="text-[0.55rem] text-muted-foreground">Período: {periodLabels[period]}</p>
          </motion.div>
          <motion.div {...anim(0.22)} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[0.65rem] text-muted-foreground font-medium">Reembolsos</p>
            <p className={`text-lg font-bold ${parseFloat(refundRate) > 5 ? "text-destructive" : ""}`}>{refundRate}%</p>
            <p className="text-[0.55rem] text-muted-foreground">{refundedSales.length} reembolso(s)</p>
          </motion.div>
        </div>

        {/* Vendas Pendentes */}
        {pendingCheckoutsCount > 0 && (
          <motion.div {...anim(0.28)} className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-warning">Vendas Pendentes</p>
              <p className="text-sm font-bold">{pendingCheckoutsCount} checkout(s) • {fmt(pendingCheckoutsValue)}</p>
            </div>
          </motion.div>
        )}

        {/* Quick Links */}
        <div className="space-y-2">
          {quickLinks.map((link, i) => (
            <motion.button
              key={link.path}
              {...anim(0.2 + i * 0.04)}
              onClick={() => navigate(link.path)}
              className="w-full flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <link.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold flex-1 text-left">{link.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* ═══════ DESKTOP LAYOUT ═══════ */}
      <div className="hidden md:block space-y-5">
        {/* Date Range + Filters */}
        <motion.div {...anim(0)} className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span className="capitalize">{today}</span>
            </div>
            <div className="flex-1" />
            <div className="flex flex-wrap items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[140px] h-8 bg-card border-border text-xs">
                  <SelectValue placeholder="Buscar produto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowValues(!showValues)}
              >
                {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {/* Period filter desktop */}
          <div className="flex flex-wrap items-center gap-2">
            {periodFilterButtons}
          </div>
          {customDatePickers}
        </motion.div>

        {/* Top Row: Greeting + Saldo + Vendas + Ticket Médio */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div {...anim(0.05)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">Olá,</p>
            <h2 className="text-lg font-bold mt-1">{displayName} 👋</h2>
            <p className="text-[0.7rem] text-muted-foreground mt-1 line-clamp-1">
              Pequenas ações geram grandes resultados
            </p>
          </motion.div>

          <motion.div {...anim(0.1)} className="rounded-xl border border-primary/30 bg-card p-5 flex flex-col">
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold mt-1">{fmt(availableBalance)}</p>
            <div className="flex-1" />
            <Button
              size="sm"
              className="w-full h-8 text-xs gap-1.5 mt-3"
              onClick={() => navigate("/finance")}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> Solicitar saque
            </Button>
          </motion.div>

          <motion.div {...anim(0.15)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">Total de vendas • {periodLabels[period]}</p>
            <p className="text-2xl font-bold mt-1">{salesCount}</p>
            <p className="text-[0.65rem] text-muted-foreground mt-1.5 flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" /> {fmt(totalRevenue)} faturado
            </p>
          </motion.div>

          <motion.div {...anim(0.2)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">Ticket médio • {periodLabels[period]}</p>
            <p className="text-2xl font-bold mt-1">{fmt(ticketMedio)}</p>
            <p className="text-[0.65rem] text-muted-foreground mt-1.5 flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Base: {salesCount} venda(s)
            </p>
          </motion.div>
        </div>

        {/* Second Row: Faturamento + Reembolso + Conquistas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div {...anim(0.22)} className="rounded-xl border-2 border-primary/40 bg-card p-5 lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Zap className="h-5 w-5 text-primary" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-primary/80 font-medium">Faturamento • {periodLabels[period]}</p>
                <p className="text-xl font-bold text-primary tracking-tight">
                  {fmtShort(totalRevenue)} <span className="text-sm font-normal text-muted-foreground">/ {fmtShort(REVENUE_GOAL)}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-2 rounded-full bg-primary/15 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${revenueProgress}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                />
              </div>
              <span className="text-xs font-bold text-primary/70">{revenueProgress.toFixed(1)}%</span>
            </div>
          </motion.div>

          <motion.div {...anim(0.28)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">Taxa de reembolso • {periodLabels[period]}</p>
            <p className={`text-2xl font-bold mt-1 ${parseFloat(refundRate) > 5 ? "text-destructive" : "text-primary"}`}>
              {refundRate}%
            </p>
            <p className="text-[0.65rem] text-muted-foreground mt-1.5 flex items-center gap-1">
              <RefreshCcw className="h-3 w-3" /> {refundedSales.length} reembolso(s) • {fmt(refundAmount)}
            </p>
          </motion.div>

          <motion.div {...anim(0.31)} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Jornada de conquistas</p>
              <button onClick={() => navigate("/sales")} className="text-[0.6rem] text-primary hover:underline">
                Saiba mais →
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-lg">{levelIcon}</span>
              <span className="text-sm font-bold">{level}</span>
            </div>
            <p className="text-[0.65rem] text-muted-foreground mt-1.5 flex items-center gap-1">
              <Flame className="h-3 w-3" /> Próximo nível: {nextLevel}
            </p>
          </motion.div>
        </div>

        {/* Vendas Pendentes (Desktop) */}
        {pendingCheckoutsCount > 0 && (
          <motion.div {...anim(0.22)} className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-warning">Vendas Pendentes</p>
              <p className="text-sm font-bold">{pendingCheckoutsCount} checkout(s) aguardando pagamento • {fmt(pendingCheckoutsValue)}</p>
            </div>
          </motion.div>
        )}

        {/* Revenue Chart + Conversion by Payment */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <motion.div {...anim(0.25)} className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Receita líquida</p>
                <p className="text-2xl font-bold mt-1">{fmt(totalRevenue)}</p>
              </div>
              <div className="flex gap-1">
                {["7d", "30d", "90d"].map((p) => (
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
            <div className="h-40 flex items-end gap-1.5">
              {chartBars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/30 hover:bg-primary/60 transition-colors relative group"
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-1.5 py-0.5 text-[0.55rem] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {fmt(Math.round(h * 100))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...anim(0.3)} className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-4">Conversão de pagamento</p>
            <div className="space-y-5">
              {paymentMethods.map((method) => {
                const data = salesByProvider[method.key] || { count: 0, amount: 0 };
                const total = filteredSales.length || 1;
                const pct = ((data.count / total) * 100);
                return (
                  <div key={method.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <method.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                        <span className="text-xs font-medium">{method.name}</span>
                      </div>
                      <span className="text-xs font-bold">{pct.toFixed(0)}% <span className="font-normal text-muted-foreground">{data.count}/{total}</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div {...anim(0.35)} className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <h3 className="text-sm font-bold">Transforme sua ideia em produto digital</h3>
            <p className="text-[0.7rem] text-muted-foreground leading-relaxed">
              Do zero ao primeiro cliente: crie, publique e venda.
            </p>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => navigate("/products/new")}>
              Criar Produto <ExternalLink className="h-3 w-3" />
            </Button>
          </motion.div>

          <motion.div {...anim(0.38)}
            className="rounded-xl border border-border bg-card p-5 space-y-2 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate("/help")}
          >
            <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Tire dúvidas</p>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Central de ajuda</span>
            </div>
            <div className="flex gap-1.5 mt-1">
              <span className="text-[0.6rem] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">+50 artigos</span>
              <span className="text-[0.6rem] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Suporte</span>
            </div>
          </motion.div>

          <motion.div {...anim(0.41)}
            className="rounded-xl border border-border bg-card p-5 space-y-2 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate("/affiliates")}
          >
            <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Lucre mais</p>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Marketplace de afiliados</span>
            </div>
            <button className="text-[0.6rem] text-primary hover:underline flex items-center gap-0.5 mt-1">
              Acessar <ExternalLink className="h-2.5 w-2.5" />
            </button>
          </motion.div>

          <motion.div {...anim(0.44)} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-3xl font-bold ${healthColor}`}>{healthScore.toFixed(0)}</span>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">A saúde da conta está</p>
                <p className="text-xs font-bold">{healthScore >= 8 ? "ótima" : healthScore >= 5 ? "regular" : "crítica"}</p>
              </div>
            </div>
            <Progress value={healthScore * 10} className="h-2 mb-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs font-bold">{refundRate}%</p>
                <p className="text-[0.55rem] text-muted-foreground">Estorno</p>
              </div>
              <div>
                <p className="text-xs font-bold">0%</p>
                <p className="text-[0.55rem] text-muted-foreground">Chargeback</p>
              </div>
              <div>
                <p className="text-xs font-bold">0%</p>
                <p className="text-[0.55rem] text-muted-foreground">MED</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
