import { useState } from "react";
import {
  Eye,
  RefreshCw,
  Zap,
  CreditCard,
  Smartphone,
  Landmark,
  QrCode,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REVENUE_GOAL = 1000000;

const paymentMethods = [
  { name: "Pix", icon: QrCode },
  { name: "Cartão de crédito", icon: CreditCard },
  { name: "Boleto", icon: Landmark },
  { name: "PIX Automático", icon: Smartphone },
];

const funnelLevels = [
  { label: "Conversão", width: "100%", color: "hsl(var(--primary))" },
  { label: "Order Bump", width: "75%", color: "hsl(var(--primary) / 0.8)" },
  { label: "Up Sell", width: "50%", color: "hsl(var(--primary) / 0.6)" },
  { label: "Downsell", width: "30%", color: "hsl(var(--primary) / 0.4)" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("today");

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

  const { data: salesData = [], refetch } = useQuery({
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

  const completedSales = salesData.filter((s) => s.status === "completed");
  const totalRevenue = completedSales.reduce(
    (acc, s) => acc + (s.amount - (s.platform_fee || 0)),
    0
  );
  const salesCount = completedSales.length;
  const refundedSales = salesData.filter((s) => s.status === "refunded");
  const refundRate = salesData.length > 0
    ? ((refundedSales.length / salesData.length) * 100).toFixed(1)
    : "0.0";
  const abandonedSales = salesData.filter((s) => s.status === "abandoned").length;

  const revenueProgress = Math.min((totalRevenue / REVENUE_GOAL) * 100, 100);

  const fmt = (v: number) =>
    `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const displayName =
    profile?.display_name || user?.email?.split("@")[0] || "Produtor";

  // Group sales by payment provider
  const salesByProvider = completedSales.reduce<Record<string, { count: number; amount: number }>>((acc, s) => {
    const provider = s.payment_provider || "Outro";
    if (!acc[provider]) acc[provider] = { count: 0, amount: 0 };
    acc[provider].count += 1;
    acc[provider].amount += s.amount - (s.platform_fee || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header with filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Última atualização: agora
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[120px] h-9 bg-card border-border text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tipo</SelectItem>
              <SelectItem value="ebook">E-book</SelectItem>
              <SelectItem value="course">Curso</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger className="w-[140px] h-9 bg-card border-border text-sm">
              <SelectValue placeholder="Produtos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Produtos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-9 bg-card border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="h-9 gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </motion.div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="rounded-xl border border-primary/30 bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Vendas realizadas</p>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tracking-tight mt-2">{fmt(totalRevenue)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Quantidade de vendas</p>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tracking-tight mt-2">{salesCount}</p>
        </motion.div>
      </div>

      {/* Payment Methods + Side Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment Methods Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="grid grid-cols-3 px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">Meios de Pagamento</span>
            <span className="text-xs font-medium text-muted-foreground text-center">Conversão</span>
            <span className="text-xs font-medium text-muted-foreground text-right flex items-center justify-end gap-1">
              Valor <Eye className="h-3 w-3" />
            </span>
          </div>
          {paymentMethods.map((method) => {
            const data = salesByProvider[method.name] || { count: 0, amount: 0 };
            const conversion = salesData.length > 0
              ? ((data.count / salesData.length) * 100).toFixed(0)
              : "0";
            return (
              <div
                key={method.name}
                className="grid grid-cols-3 px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <method.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-medium">{method.name}</span>
                </div>
                <span className="text-sm text-center self-center font-medium">{conversion}%</span>
                <span className="text-sm text-right self-center font-medium">{fmt(data.amount)}</span>
              </div>
            );
          })}
        </motion.div>

        {/* Side Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="space-y-4"
        >
          {[
            { label: "Abandono C.", value: String(abandonedSales) },
            { label: "Reembolso", value: `${refundRate}%` },
            { label: "Charge Back", value: "0%" },
            { label: "MED", value: "0%" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold mt-0.5">{stat.value}</p>
              </div>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </motion.div>
      </div>

      {/* Conversion Funnel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <h2 className="text-lg font-bold tracking-tight mb-6">Funil de Conversão</h2>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
          {/* Funnel Visual */}
          <div className="lg:col-span-3 flex flex-col items-center gap-2">
            {funnelLevels.map((level, i) => (
              <div
                key={level.label}
                className="h-16 rounded-lg transition-all"
                style={{
                  width: level.width,
                  background: level.color,
                  clipPath: i === funnelLevels.length - 1
                    ? "polygon(15% 0%, 85% 0%, 50% 100%)"
                    : `polygon(${i * 5}% 0%, ${100 - i * 5}% 0%, ${100 - (i + 1) * 5}% 100%, ${(i + 1) * 5}% 100%)`,
                }}
              />
            ))}
          </div>

          {/* Funnel Stats */}
          <div className="lg:col-span-2 space-y-4">
            {funnelLevels.map((level) => (
              <div key={level.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: level.color }} />
                  <span className="text-sm font-medium">{level.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">0.0%</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Ver Mais
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Sales Chart Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <h2 className="text-lg font-bold tracking-tight mb-4">Vendas por período</h2>
        <div className="h-48 flex items-end justify-between gap-1.5 px-4">
          {Array.from({ length: 14 }).map((_, i) => {
            const h = Math.random() * 60 + 10;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-primary/40 hover:bg-primary/70 transition-colors"
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 px-4">
          <span className="text-[0.6rem] text-muted-foreground">1</span>
          <span className="text-[0.6rem] text-muted-foreground">7</span>
          <span className="text-[0.6rem] text-muted-foreground">14</span>
        </div>
      </motion.div>
    </div>
  );
}
