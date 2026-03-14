import {
  DollarSign,
  Package,
  TrendingUp,
  Link2,
  BarChart3,
  ShieldCheck,
  Headphones,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const REVENUE_GOAL = 1000000; // R$ 10.000 in cents

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
        .select("amount, platform_fee, status, created_at")
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

  const completedSales = salesData.filter((s) => s.status === "completed");
  const totalRevenue = completedSales.reduce(
    (acc, s) => acc + (s.amount - (s.platform_fee || 0)),
    0
  );
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((acc, w) => acc + w.amount, 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((acc, w) => acc + w.amount, 0);

  const availableBalance = totalRevenue - totalWithdrawn - pendingWithdrawals;
  const revenueProgress = Math.min((totalRevenue / REVENUE_GOAL) * 100, 100);

  const displayName =
    profile?.display_name || user?.email?.split("@")[0] || "Produtor";

  const quickLinks = [
    { label: "Relatórios", icon: BarChart3, path: "/sales" },
    { label: "Produtos", icon: Package, path: "/products" },
    { label: "Afiliados", icon: Link2, path: "/affiliates" },
    { label: "Suporte", icon: Headphones, path: "/admin/settings" },
  ];

  const fmt = (v: number) =>
    `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="flex items-center gap-3"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary">
          <span className="text-lg font-bold text-primary-foreground">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Olá,</p>
          <p className="text-lg font-bold tracking-title">{displayName}</p>
        </div>
      </motion.div>

      {/* Revenue / Faturamento Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="rounded-xl border-2 border-primary/30 bg-card p-5 space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground tracking-label uppercase">
              Faturamento
            </p>
            <p className="text-xl font-bold tracking-title stat-value">
              {fmt(totalRevenue)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {fmt(REVENUE_GOAL)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={revenueProgress} className="h-2 flex-1" />
          <span className="text-xs font-medium text-muted-foreground min-w-[40px] text-right">
            {revenueProgress.toFixed(1)}%
          </span>
        </div>
      </motion.div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.2, 0, 0, 1] }}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div>
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-xl font-bold tracking-title stat-value mt-1">
              {fmt(availableBalance)}
            </p>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => navigate("/finance")}
          >
            Sacar
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.2, 0, 0, 1] }}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div>
            <p className="text-xs text-muted-foreground">Saldo pendente</p>
            <p className="text-xl font-bold tracking-title stat-value mt-1">
              {fmt(pendingWithdrawals)}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => navigate("/sales")}
          >
            Receitas
          </Button>
        </motion.div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-2.5">
        {quickLinks.map((link, i) => (
          <motion.button
            key={link.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.2 + i * 0.04,
              duration: 0.4,
              ease: [0.2, 0, 0, 1],
            }}
            onClick={() => navigate(link.path)}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 hover:bg-card/80 transition-colors text-left group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <link.icon
                className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors"
                strokeWidth={1.5}
              />
            </div>
            <span className="flex-1 text-sm font-medium">{link.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
