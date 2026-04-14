import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";

const categoryLabels: Record<string, string> = {
  sale: "Venda",
  commission: "Comissão",
  fee: "Taxa",
  withdrawal: "Saque",
  refund: "Reembolso",
  chargeback: "Chargeback",
  med: "MED Pix",
  service_fee: "Taxa de serviço",
};

const categoryIcons: Record<string, string> = {
  sale: "💰",
  commission: "🤝",
  fee: "🏷️",
  withdrawal: "💸",
  refund: "↩️",
  chargeback: "⚠️",
  med: "⚠️",
  service_fee: "🏷️",
};

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 10 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.4, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

type PeriodKey = "7d" | "30d" | "90d" | "all";
const PERIOD_LABELS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Tudo" },
];

export default function Transactions() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "credit" | "debit">("all");
  const [showValues, setShowValues] = useState(true);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      if (period !== "all") {
        const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - days);
        if (new Date(t.created_at) < cutoff) return false;
      }
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, period, categoryFilter, typeFilter]);

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const t of filtered) {
      if (t.type === "credit") credits += t.amount;
      else debits += t.amount;
    }
    return { credits, debits, net: credits - debits };
  }, [filtered]);

  const fmt = (v: number) => showValues
    ? `R$ ${(Math.abs(v) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "R$ •••••";

  const handleExport = () => {
    const headers = ["Data", "Tipo", "Categoria", "Valor (R$)", "Referência"];
    const rows = filtered.map((t) => [
      new Date(t.created_at).toLocaleString("pt-BR"),
      t.type === "credit" ? "Crédito" : "Débito",
      categoryLabels[t.category] || t.category,
      (t.amount / 100).toFixed(2),
      t.reference_id || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories = useMemo(() => {
    const set = new Set(transactions.map(t => t.category));
    return Array.from(set);
  }, [transactions]);

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div {...anim(0)} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Extrato</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowValues(!showValues)}>
            {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-3">
        {[
          { label: "Entradas", value: totals.credits, icon: TrendingUp, accent: true, sub: `${filtered.filter(t => t.type === 'credit').length} transações` },
          { label: "Saídas", value: totals.debits, icon: TrendingDown, accent: false, sub: `${filtered.filter(t => t.type === 'debit').length} transações`, isNegative: true },
          { label: "Saldo líquido", value: totals.net, icon: Receipt, accent: false, sub: "Entradas - Saídas" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            {...anim(0.05 + i * 0.05)}
            className={`rounded-xl border p-5 ${stat.accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.accent ? "text-primary" : stat.isNegative ? "text-destructive" : "text-muted-foreground"}`} strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.accent ? "text-primary" : stat.isNegative ? "text-destructive" : "text-foreground"}`}>
              {fmt(stat.value)}
            </p>
            <p className="text-[0.6rem] text-muted-foreground mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters Row */}
      <motion.div {...anim(0.2)} className="flex flex-wrap items-center gap-3">
        {/* Period Pills */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {PERIOD_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {(["all", "credit", "debit"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todos" : f === "credit" ? "Entradas" : "Saídas"}
            </button>
          ))}
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Transaction List */}
      <motion.div {...anim(0.25)} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Movimentações</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} registro(s)</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma movimentação encontrada.</div>
        ) : (
          <div>
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }}
                className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      t.type === "credit" ? "bg-emerald-500/10" : "bg-destructive/10"
                    }`}
                  >
                    {t.type === "credit" ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {categoryIcons[t.category]} {categoryLabels[t.category] || t.category}
                      </span>
                      <span className={`text-[0.55rem] px-1.5 py-0.5 rounded font-medium ${
                        t.type === "credit" ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                      }`}>
                        {t.type === "credit" ? "Entrada" : "Saída"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {t.reference_id && <span className="ml-2 opacity-60">ref: {t.reference_id.substring(0, 8)}…</span>}
                    </p>
                  </div>
                </div>

                <p className={`text-sm font-bold whitespace-nowrap ${t.type === "credit" ? "text-emerald-500" : "text-destructive"}`}>
                  {t.type === "credit" ? "+" : "-"} {fmt(t.amount)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
