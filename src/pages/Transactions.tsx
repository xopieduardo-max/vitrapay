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
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.45, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
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
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (!page || page.length === 0) break;
        allData.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      return allData;
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

  const fmt = (v: number) =>
    showValues
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
    const set = new Set(transactions.map((t) => t.category));
    return Array.from(set);
  }, [transactions]);

  const creditCount = filtered.filter((t) => t.type === "credit").length;
  const debitCount = filtered.filter((t) => t.type === "debit").length;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div {...anim(0)} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Extrato</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Histórico completo de movimentações</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setShowValues(!showValues)}
          >
            {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs rounded-lg border-border"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar</span> CSV
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards — stack vertically on mobile */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {/* Entradas */}
        <motion.div
          {...anim(0.05)}
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-2xl" />
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground font-medium">Entradas</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-primary">{fmt(totals.credits)}</p>
              <p className="text-[0.65rem] text-muted-foreground mt-1">{creditCount} transações</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ArrowDownLeft className="h-5 w-5 text-primary" />
            </div>
          </div>
        </motion.div>

        {/* Saídas */}
        <motion.div
          {...anim(0.1)}
          className="rounded-2xl border border-border bg-card p-4 md:p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-destructive/60 rounded-t-2xl" />
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground font-medium">Saídas</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-destructive">{fmt(totals.debits)}</p>
              <p className="text-[0.65rem] text-muted-foreground mt-1">{debitCount} transações</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </motion.div>

        {/* Saldo líquido */}
        <motion.div
          {...anim(0.15)}
          className="rounded-2xl border border-border bg-card p-4 md:p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted-foreground/30 rounded-t-2xl" />
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Receipt className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground font-medium">Saldo líquido</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground">{fmt(totals.net)}</p>
              <p className="text-[0.65rem] text-muted-foreground mt-1">Entradas − Saídas</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div {...anim(0.2)} className="space-y-2.5">
        {/* Period + Type in a row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border">
            {PERIOD_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border">
            {(["all", "credit", "debit"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  typeFilter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : f === "credit" ? "Entradas" : "Saídas"}
              </button>
            ))}
          </div>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted border border-border"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted border border-border"
              }`}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Transaction List */}
      <motion.div {...anim(0.25)} className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/20">
          <h2 className="text-sm font-semibold">Movimentações</h2>
          <span className="text-[0.65rem] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-medium">
            {filtered.length} registro(s)
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Carregando extrato…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.5) }}
                className="flex items-center justify-between px-4 md:px-5 py-3 hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      t.type === "credit"
                        ? "bg-primary/10"
                        : "bg-destructive/10"
                    }`}
                  >
                    {t.type === "credit" ? (
                      <ArrowDownLeft className="h-4 w-4 text-primary" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {categoryIcons[t.category]} {categoryLabels[t.category] || t.category}
                      </span>
                      <span
                        className={`text-[0.6rem] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                          t.type === "credit"
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {t.type === "credit" ? "Entrada" : "Saída"}
                      </span>
                    </div>
                    <p className="text-[0.65rem] text-muted-foreground truncate mt-0.5">
                      {new Date(t.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {t.reference_id && (
                        <span className="ml-2 opacity-60">
                          ref: {t.reference_id.substring(0, 8)}…
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <p
                  className={`text-sm font-bold whitespace-nowrap ml-3 ${
                    t.type === "credit" ? "text-primary" : "text-destructive"
                  }`}
                >
                  {t.type === "credit" ? "+" : "−"} {fmt(t.amount)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
