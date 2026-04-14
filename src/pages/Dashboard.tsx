import { useState, useMemo, useRef } from "react";
import {
  Eye,
  EyeOff,
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
  Target,
  CalendarDays,
  Info,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import dashboardBanner from "@/assets/dashboard-banner.png";
import BannerCarousel from "@/components/BannerCarousel";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ─── Constants & Helpers ────────────────────────────────────────────────────

const MILESTONES = [1000000, 10000000, 25000000, 50000000, 100000000];
const MILESTONE_LABELS = ["10k", "100k", "250k", "500k", "1M"];
const MILESTONE_NAMES = ["Iniciante", "Bronze", "Prata", "Gold", "Black"];
const MILESTONE_EMOJIS = ["🔥", "🥉", "🥈", "🥇", "🖤"];

function getCurrentGoal(revenue: number) {
  for (const m of MILESTONES) {
    if (revenue < m) return m;
  }
  return MILESTONES[MILESTONES.length - 1];
}

function getMilestoneIndex(revenue: number) {
  for (let i = 0; i < MILESTONES.length; i++) {
    if (revenue < MILESTONES[i]) return i;
  }
  return MILESTONES.length;
}

function getCurrentLevelName(idx: number) {
  if (idx === 0) return "Primeira venda";
  return `${MILESTONE_LABELS[idx - 1]} - ${MILESTONE_NAMES[idx - 1]}`;
}

function getNextLevelName(idx: number) {
  if (idx >= MILESTONES.length) return "Nível máximo";
  return `${MILESTONE_LABELS[idx]} - ${MILESTONE_NAMES[idx]}`;
}

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
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "today":
      return { from: todayStart, to: todayEnd };
    case "yesterday": {
      const yStart = new Date(todayStart);
      yStart.setDate(yStart.getDate() - 1);
      return { from: yStart, to: todayStart };
    }
    case "7d": {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - 7);
      return { from: d, to: todayEnd };
    }
    case "30d": {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - 30);
      return { from: d, to: todayEnd };
    }
    case "all":
      return { from: null, to: todayEnd };
    case "custom": {
      const cfrom = customFrom || todayStart;
      const cto = customTo ? new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate(), 23, 59, 59, 999) : todayEnd;
      return { from: cfrom, to: cto };
    }
    default:
      return { from: null, to: todayEnd };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [showValues, setShowValues] = useState(true);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [balanceTab, setBalanceTab] = useState<"pending" | "available">("available");
  const [regionView, setRegionView] = useState<'state' | 'city'>('state');
  const [sideStatsView, setSideStatsView] = useState<'qty' | 'pct'>('qty');

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, card_plan")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: wallet } = useQuery({
    queryKey: ["dashboard-wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("wallets")
        .select("balance_available, balance_pending, balance_total")
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
        .select("amount, platform_fee, status, created_at, payment_provider, buyer_city, buyer_state, buyer_country")
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

  // ─── Computed Values ────────────────────────────────────────────────────

  const dateRange = useMemo(() => getDateRange(period, customFrom, customTo), [period, customFrom, customTo]);

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
  const WITHDRAWAL_FEE = 500;
  const pendingWithdrawalsGross = withdrawals.filter((w) => w.status === "pending" || w.status === "processing").reduce((acc, w) => acc + w.amount + WITHDRAWAL_FEE, 0);

  const walletAvailable = Number(wallet?.balance_available ?? 0);
  const walletPending = Number(wallet?.balance_pending ?? 0);
  const availableBalance = Math.max(0, walletAvailable - pendingWithdrawalsGross);
  const ticketMedio = salesCount > 0 ? totalRevenue / salesCount : 0;
  const refundedSales = filteredSales.filter((s) => s.status === "refunded");
  const chargebackSales = filteredSales.filter((s) => s.status === "chargeback");
  const medSales = filteredSales.filter((s) => s.status === "med");
  const refundRate = filteredSales.length > 0 ? ((refundedSales.length / filteredSales.length) * 100).toFixed(1) : "0";
  const chargebackRate = filteredSales.length > 0 ? (((chargebackSales.length + medSales.length) / filteredSales.length) * 100).toFixed(1) : "0";
  const refundAmount = refundedSales.reduce((acc, s) => acc + s.amount, 0);

  const filteredCheckouts = useMemo(() => {
    return allCheckouts.filter((c) => {
      const d = new Date(c.created_at);
      if (dateRange.from && d < dateRange.from) return false;
      if (d > dateRange.to) return false;
      return true;
    });
  }, [allCheckouts, dateRange]);
  const totalCheckoutInitiations = filteredCheckouts.length + salesCount;
  const checkoutConversionRate = totalCheckoutInitiations > 0
    ? ((salesCount / totalCheckoutInitiations) * 100).toFixed(1)
    : "0";

  const totalRevenueAll = completedSalesAll.reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);
  const milestoneIdx = getMilestoneIndex(totalRevenueAll);

  // Sales by provider
  const salesByProvider = completedSales.reduce<Record<string, { count: number; amount: number }>>((acc, s) => {
    const provider = s.payment_provider || "Outro";
    if (!acc[provider]) acc[provider] = { count: 0, amount: 0 };
    acc[provider].count += 1;
    acc[provider].amount += s.amount - (s.platform_fee || 0);
    return acc;
  }, {});

  const cardApproval = salesByProvider["card"]?.count || 0;
  const pixConversion = salesByProvider["pix"]?.count || 0;
  const boletoConversion = salesByProvider["boleto"]?.count || 0;
  const totalFiltered = filteredSales.length || 1;

  // ─── Chart Data (line chart style, monthly) ─────────────────────────────

  const [chartMode, setChartMode] = useState<"day" | "month" | "year">("month");
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartProduct, setChartProduct] = useState("all");
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  const chartData = useMemo(() => {
    const salesForChart = chartProduct === "all"
      ? completedSalesAll
      : completedSalesAll; // product filter would need product_id in the query

    if (chartMode === "day") {
      // Last 30 days
      const days: { label: string; value: number }[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        const value = salesForChart
          .filter(s => new Date(s.created_at).toISOString().slice(0, 10) === key)
          .reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);
        days.push({ label, value });
      }
      return days;
    }

    if (chartMode === "year") {
      // By year
      const years = new Map<number, number>();
      salesForChart.forEach(s => {
        const y = new Date(s.created_at).getFullYear();
        years.set(y, (years.get(y) || 0) + (s.amount - (s.platform_fee || 0)));
      });
      const sorted = Array.from(years.entries()).sort((a, b) => a[0] - b[0]);
      return sorted.map(([y, v]) => ({ label: y.toString(), value: v }));
    }

    // month mode - by month for selected year
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return monthNames.map((label, i) => {
      const value = salesForChart
        .filter(s => {
          const d = new Date(s.created_at);
          return d.getFullYear() === chartYear && d.getMonth() === i;
        })
        .reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);
      return { label, value };
    });
  }, [completedSalesAll, chartMode, chartYear, chartProduct]);

  const maxChartValue = Math.max(...chartData.map(d => d.value), 1);

  // ─── Formatters ─────────────────────────────────────────────────────────

  const fmt = (v: number) => showValues
    ? `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "R$ •••••";

  const fmtCompact = (v: number) => {
    const val = v / 100;
    if (val >= 1000000) return `${(val / 1000000).toFixed(0)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toFixed(0);
  };

  const handlePeriodChange = (p: PeriodKey) => {
    if (p === "custom") {
      setPeriod("custom");
    } else {
      setPeriod(p);
    }
  };

  // ─── SVG Line Chart ────────────────────────────────────────────────────

  const renderLineChart = () => {
    if (chartData.length === 0) return null;

    const width = 800;
    const height = 250;
    const padLeft = 50;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 40;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const yTicks = 5;
    const yMax = maxChartValue;

    const points = chartData.map((d, i) => {
      const x = padLeft + (i / Math.max(chartData.length - 1, 1)) * chartW;
      const y = padTop + chartH - (d.value / yMax) * chartH;
      return { x, y, ...d };
    });

    const pathD = points.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
    }).join(" ");

    const areaD = pathD + ` L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = chartRef.current;
      if (!svg || points.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * width;
      let closest = 0;
      let minDist = Infinity;
      points.forEach((p, i) => {
        const d = Math.abs(p.x - mouseX);
        if (d < minDist) { minDist = d; closest = i; }
      });
      setHoveredPoint(closest);
    };

    return (
      <svg
        ref={chartRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = padTop + (i / yTicks) * chartH;
          const val = yMax - (i / yTicks) * yMax;
          return (
            <g key={i}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="10">
                {fmtCompact(val)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#chartGradient)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x} cy={p.y}
              r={hoveredPoint === i ? 5 : 3}
              fill={hoveredPoint === i ? "hsl(142 71% 45%)" : "hsl(var(--primary))"}
              stroke="hsl(var(--background))"
              strokeWidth="2"
              style={{ transition: "r 0.15s, fill 0.15s" }}
            />
          </g>
        ))}

        {/* Hover tooltip */}
        {hoveredPoint !== null && points[hoveredPoint] && (() => {
          const p = points[hoveredPoint];
          const text = `R$ ${(p.value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
          const tooltipW = Math.max(text.length * 7, 80);
          const tooltipH = 22;
          let tx = p.x - tooltipW / 2;
          if (tx < padLeft) tx = padLeft;
          if (tx + tooltipW > width - padRight) tx = width - padRight - tooltipW;
          
          // Flip below if too close to top
          const flipBelow = p.y - tooltipH - 10 < padTop;
          const ty = flipBelow ? p.y + 10 : p.y - tooltipH - 10;
          const arrowY = flipBelow
            ? ty - 5
            : ty + tooltipH;
          const arrowPoints = flipBelow
            ? `${p.x - 4},${ty} ${p.x + 4},${ty} ${p.x},${ty - 5}`
            : `${p.x - 4},${ty + tooltipH} ${p.x + 4},${ty + tooltipH} ${p.x},${ty + tooltipH + 5}`;

          return (
            <g>
              <line x1={p.x} y1={padTop} x2={p.x} y2={padTop + chartH} stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
              <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx={5} fill="hsl(142 71% 45%)" />
              <polygon points={arrowPoints} fill="hsl(142 71% 45%)" />
              <text x={tx + tooltipW / 2} y={ty + tooltipH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="bold">
                {text}
              </text>
            </g>
          );
        })()}

        {/* X labels */}
        {points.map((p, i) => {
          const skip = chartData.length > 15 ? Math.ceil(chartData.length / 12) : 1;
          if (i % skip !== 0 && i !== chartData.length - 1) return null;
          return (
            <text key={i} x={p.x} y={height - 8} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">
              {p.label}
            </text>
          );
        })}
      </svg>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <MilestoneCelebration revenue={totalRevenueAll} milestones={MILESTONES} />

      {/* ═══════ MOBILE LAYOUT ═══════ */}
      <div className="md:hidden space-y-4">
        {/* Period filters mobile */}
        <motion.div {...anim(0)} className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(periodLabels) as PeriodKey[]).filter(p => p !== "custom").map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
          <button
            onClick={() => setShowValues(!showValues)}
            className="ml-auto h-7 w-7 flex items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            {showValues ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        </motion.div>

        {/* Balance card mobile */}
        <motion.div {...anim(0.05)} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setBalanceTab("pending")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${balanceTab === "pending" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              À receber
            </button>
            <button
              onClick={() => setBalanceTab("available")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${balanceTab === "available" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              Disponível
            </button>
          </div>
          <p className="text-2xl font-bold">
            {balanceTab === "available" ? fmt(availableBalance) : fmt(walletPending)}
          </p>
          <Button
            size="sm"
            className="mt-3 h-8 text-xs gap-1.5"
            onClick={() => navigate("/finance")}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Solicitar saque
          </Button>
        </motion.div>

        {/* Stats grid mobile */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div {...anim(0.1)} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[0.65rem] text-muted-foreground">Vendas</p>
            <p className="text-lg font-bold">{salesCount}</p>
          </motion.div>
          <motion.div {...anim(0.12)} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[0.65rem] text-muted-foreground">Ticket médio</p>
            <p className="text-lg font-bold">{fmt(ticketMedio)}</p>
          </motion.div>
          <motion.div {...anim(0.14)} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[0.65rem] text-muted-foreground">Carrinhos abandonados</p>
            <p className="text-lg font-bold">{pendingCheckoutsCount}</p>
          </motion.div>
          <motion.div {...anim(0.16)} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[0.65rem] text-muted-foreground">Conv. Checkout</p>
            <p className="text-lg font-bold">{checkoutConversionRate}%</p>
          </motion.div>
        </div>

        {/* Quick links mobile */}
        <div className="space-y-2">
          {[
            { label: "Minhas Vendas", icon: BarChart3, path: "/sales" },
            { label: "Meus Produtos", icon: Package, path: "/products" },
            { label: "Afiliados", icon: Users, path: "/affiliates" },
            { label: "Suporte", icon: HelpCircle, path: "/help" },
          ].map((link, i) => (
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
        {/* Header: Title */}
        <motion.div {...anim(0)} className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowValues(!showValues)}
            >
              {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        </motion.div>

        {/* Row 1: Balance Card + Milestone Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Balance Card */}
          <motion.div {...anim(0.05)} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-1 mb-4">
              <button
                onClick={() => setBalanceTab("pending")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  balanceTab === "pending" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                À receber
              </button>
              <button
                onClick={() => setBalanceTab("available")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  balanceTab === "available" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Disponível
              </button>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold tracking-tight">
                {balanceTab === "available" ? fmt(availableBalance) : fmt(walletPending)}
              </p>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 rounded-full px-4"
                onClick={() => navigate("/finance")}
              >
                <ArrowDownToLine className="h-3.5 w-3.5" /> Antecipar
              </Button>
            </div>
          </motion.div>

          {/* Milestone Tracker - Pepper Style */}
          <motion.div {...anim(0.1)} className="rounded-xl border border-border bg-card p-5">
            {(() => {
              const currentGoal = getCurrentGoal(totalRevenueAll);
              const prevGoal = milestoneIdx > 0 ? MILESTONES[milestoneIdx - 1] : 0;
              const progressInLevel = milestoneIdx < MILESTONES.length
                ? ((totalRevenueAll - prevGoal) / (currentGoal - prevGoal)) * 100
                : 100;
              const remaining = Math.max(0, currentGoal - totalRevenueAll);

              return (
                <div className="space-y-3">
                  {/* Header with current level and next level */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground italic">{getCurrentLevelName(milestoneIdx)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getNextLevelName(milestoneIdx)}</span>
                      {/* Info button to see all levels */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Níveis de vendas</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            {MILESTONES.map((m, i) => {
                              const reached = milestoneIdx > i;
                              const current = milestoneIdx === i;
                              return (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${current ? "bg-primary/10 border border-primary/30" : reached ? "bg-muted/50" : "opacity-60"}`}>
                                  <span className="text-xl">{MILESTONE_EMOJIS[i]}</span>
                                  <div className="flex-1">
                                    <p className={`text-sm font-semibold ${reached ? "text-primary" : current ? "text-foreground" : ""}`}>
                                      {MILESTONE_LABELS[i]} - {MILESTONE_NAMES[i]}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      R$ {(m / 100).toLocaleString("pt-BR")} em faturamento
                                    </p>
                                  </div>
                                  {reached && <span className="text-primary font-bold text-sm">✓</span>}
                                  {current && <span className="text-xs text-primary font-medium">Atual</span>}
                                </div>
                              );
                            })}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(progressInLevel, 100)}%`,
                        background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`,
                      }}
                    />
                    {/* Level emoji at end of bar */}
                    {milestoneIdx < MILESTONES.length && (
                      <span
                        className="absolute top-1/2 -translate-y-1/2 text-sm transition-all duration-700"
                        style={{ left: `calc(${Math.min(progressInLevel, 97)}% - 4px)` }}
                      >
                        {MILESTONE_EMOJIS[milestoneIdx]}
                      </span>
                    )}
                  </div>

                  {/* Remaining text */}
                  <p className="text-center text-sm text-muted-foreground">
                    Faltam <strong className="text-foreground">R$ {(remaining / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> em saques para você atingir o próximo nível
                  </p>
                </div>
              );
            })()}
          </motion.div>
        </div>

        {/* Row 2: Revenue Chart (left) + Side Stats (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Revenue Chart */}
          <motion.div {...anim(0.15)} className="rounded-xl border border-border bg-card p-5">
            {/* Chart header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Receita líquida total</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Receita líquida após taxas da plataforma</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-2xl font-bold mt-1">{fmt(totalRevenue)}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Chart mode selector */}
                <div className="flex items-center bg-muted rounded-lg p-0.5">
                  {(["day", "month", "year"] as const).map(mode => {
                    const labels = { day: "Dia", month: "Mês", year: "Ano" };
                    return (
                      <button
                        key={mode}
                        onClick={() => setChartMode(mode)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          chartMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {labels[mode]}
                      </button>
                    );
                  })}
                </div>
                {chartMode === "month" && (
                  <Select value={chartYear.toString()} onValueChange={(v) => setChartYear(Number(v))}>
                    <SelectTrigger className="w-[90px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={chartProduct} onValueChange={setChartProduct}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[250px] w-full">
              {renderLineChart()}
            </div>
          </motion.div>

          {/* Side Stats */}
          <motion.div {...anim(0.2)} className="rounded-xl border border-border bg-card p-5 space-y-0">
            {/* Toggle Qty / % */}
            <div className="flex items-center justify-end mb-4">
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setSideStatsView('qty')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    sideStatsView === 'qty' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Qtd.
                </button>
                <button
                  onClick={() => setSideStatsView('pct')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    sideStatsView === 'pct' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  %
                </button>
              </div>
            </div>

            {/* Stats list */}
            <div className="space-y-5">
              <div>
                <p className="text-xs text-primary mb-1">Aprovação cartão</p>
                <p className="text-2xl font-bold">
                  {sideStatsView === 'qty' ? cardApproval.toLocaleString("pt-BR") : `${totalFiltered > 0 ? ((cardApproval / totalFiltered) * 100).toFixed(1) : 0}%`}
                </p>
              </div>
              <div>
                <p className="text-xs text-primary mb-1">Conversão pix</p>
                <p className="text-2xl font-bold">
                  {sideStatsView === 'qty' ? pixConversion.toLocaleString("pt-BR") : `${totalFiltered > 0 ? ((pixConversion / totalFiltered) * 100).toFixed(1) : 0}%`}
                </p>
              </div>
              <div>
                <p className="text-xs text-primary mb-1">Conversão boleto</p>
                <p className="text-2xl font-bold">
                  {sideStatsView === 'qty' ? boletoConversion.toLocaleString("pt-BR") : `${totalFiltered > 0 ? ((boletoConversion / totalFiltered) * 100).toFixed(1) : 0}%`}
                </p>
              </div>
              <div>
                <p className="text-xs text-destructive mb-1">Reembolsos</p>
                <p className="text-2xl font-bold">
                  {sideStatsView === 'qty' ? refundedSales.length.toLocaleString("pt-BR") : `${refundRate}%`}
                </p>
              </div>
              <div>
                <p className="text-xs text-destructive mb-1">Chargebacks</p>
                <p className="text-2xl font-bold">
                  {sideStatsView === 'qty' ? (chargebackSales.length + medSales.length).toLocaleString("pt-BR") : `${chargebackRate}%`}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Row 3: Bottom Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div {...anim(0.25)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Número de vendas</p>
            <p className="text-2xl font-bold">{salesCount.toLocaleString("pt-BR")}</p>
            <p className="text-[0.6rem] text-muted-foreground mt-1">{salesCount} vendas aprovadas no período</p>
          </motion.div>
          <motion.div {...anim(0.27)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Ticket médio</p>
            <p className="text-2xl font-bold">{fmt(ticketMedio)}</p>
            <p className="text-[0.6rem] text-muted-foreground mt-1">Média por venda aprovada</p>
          </motion.div>
          <motion.div {...anim(0.29)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Carrinhos abandonados</p>
            <p className="text-2xl font-bold">{pendingCheckoutsCount.toLocaleString("pt-BR")}</p>
            <p className="text-[0.6rem] text-muted-foreground mt-1">{fmt(pendingCheckoutsValue)} em checkouts pendentes</p>
          </motion.div>
          <motion.div {...anim(0.31)} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Conv. Checkout</p>
            <p className="text-2xl font-bold">{checkoutConversionRate}%</p>
            <p className="text-[0.6rem] text-muted-foreground mt-1">{salesCount} vendas de {totalCheckoutInitiations} visitas</p>
          </motion.div>
          <motion.div {...anim(0.33)} className="rounded-xl border border-border bg-card p-5 col-span-2 lg:col-span-1">
            <p className="text-xs text-muted-foreground mb-1">Faturamento bruto</p>
            <p className="text-2xl font-bold">{fmt(completedSales.reduce((a, s) => a + s.amount, 0))}</p>
            <p className="text-[0.6rem] text-muted-foreground mt-1">Antes das taxas da plataforma</p>
          </motion.div>
        </div>

        {/* Row 4: Regional Sales + Period Filter */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vendas por Região */}
          {(() => {
            const completedWithGeo = filteredSales.filter(s => s.status === "completed");
            const stateMap = new Map<string, { orders: number; value: number }>();
            const cityMap = new Map<string, { orders: number; value: number; state: string }>();

            for (const s of completedWithGeo) {
              const sale = s as any;
              if (sale.buyer_state) {
                const existing = stateMap.get(sale.buyer_state) || { orders: 0, value: 0 };
                existing.orders += 1;
                existing.value += sale.amount || 0;
                stateMap.set(sale.buyer_state, existing);
              }
              if (sale.buyer_city && sale.buyer_state) {
                const key = `${sale.buyer_city}|${sale.buyer_state}`;
                const existing = cityMap.get(key) || { orders: 0, value: 0, state: sale.buyer_state };
                existing.orders += 1;
                existing.value += sale.amount || 0;
                cityMap.set(key, existing);
              }
            }

            const stateData = Array.from(stateMap.entries())
              .map(([name, d]) => ({ name, abbr: "", orders: d.orders, value: d.value }))
              .sort((a, b) => b.orders - a.orders)
              .slice(0, 5)
              .map((item, i) => ({ ...item, rank: i + 1 }));

            const cityData = Array.from(cityMap.entries())
              .map(([key, d]) => {
                const [city] = key.split("|");
                return { name: city, abbr: d.state, orders: d.orders, value: d.value };
              })
              .sort((a, b) => b.orders - a.orders)
              .slice(0, 5)
              .map((item, i) => ({ ...item, rank: i + 1 }));

            const currentRegionData = regionView === 'state' ? stateData : cityData;
            const maxOrders = currentRegionData[0]?.orders || 1;
            const totalOrders = regionView === 'state'
              ? Array.from(stateMap.values()).reduce((acc, d) => acc + d.orders, 0)
              : Array.from(cityMap.values()).reduce((acc, d) => acc + d.orders, 0);
            const hasData = currentRegionData.length > 0;

            return (
              <motion.div {...anim(0.35)} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <p className="text-xs text-muted-foreground">Vendas por região</p>
                    <div className="flex items-center gap-0.5 ml-2 bg-muted rounded-full p-0.5">
                      <button
                        onClick={() => setRegionView('state')}
                        className={`text-[0.6rem] px-2.5 py-1 rounded-full font-medium transition-all ${regionView === 'state' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Estado
                      </button>
                      <button
                        onClick={() => setRegionView('city')}
                        className={`text-[0.6rem] px-2.5 py-1 rounded-full font-medium transition-all ${regionView === 'city' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Cidade
                      </button>
                    </div>
                  </div>
                  <span className="text-[0.6rem] text-muted-foreground">Total: <strong className="text-foreground">{totalOrders}</strong></span>
                </div>
                {hasData ? (
                  <div className="space-y-3">
                    {currentRegionData.map((item) => {
                      const pct = (item.orders / maxOrders) * 100;
                      return (
                        <div key={item.name + item.abbr} className="flex items-center gap-3">
                          <span className="text-[0.6rem] font-bold text-muted-foreground w-4 text-right">{item.rank}</span>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">
                                {item.name}
                                {item.abbr && <span className="text-muted-foreground"> ({item.abbr})</span>}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[0.6rem] text-muted-foreground">{item.orders} pedidos</span>
                                <span className="text-xs font-bold">{fmt(item.value)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MapPin className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">Dados regionais aparecerão aqui após as próximas vendas</p>
                  </div>
                )}
              </motion.div>
            );
          })()}

          {/* Period filter card */}
          <motion.div {...anim(0.37)} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs text-muted-foreground">Filtro de período</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(periodLabels) as PeriodKey[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {customFrom ? format(customFrom, "dd/MM/yyyy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
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
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Quick actions */}
            <div className="pt-2 space-y-2">
              <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Ações rápidas</p>
              {[
                { label: "Criar Produto", icon: Package, path: "/products/new" },
                { label: "Central de Ajuda", icon: HelpCircle, path: "/help" },
                { label: "Afiliados", icon: Users, path: "/affiliates" },
              ].map(link => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="w-full flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <link.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <span className="text-xs font-medium flex-1">{link.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
