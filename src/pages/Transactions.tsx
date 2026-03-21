import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
} from "lucide-react";

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

const categoryColors: Record<string, string> = {
  sale: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  commission: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  fee: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  withdrawal: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  refund: "bg-destructive/10 text-destructive border-destructive/20",
};

type Period = "7d" | "30d" | "90d" | "all";

export default function Transactions() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("30d");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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
      // Period filter
      if (period !== "all") {
        const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - days);
        if (new Date(t.created_at) < cutoff) return false;
      }
      // Category filter
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [transactions, period, categoryFilter]);

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const t of filtered) {
      if (t.type === "credit") credits += t.amount;
      else debits += t.amount;
    }
    return { credits, debits, net: credits - debits };
  }, [filtered]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Extrato</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico completo de movimentações
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 w-fit" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-3">
        {[
          {
            label: "Entradas",
            value: totals.credits,
            icon: TrendingUp,
            color: "text-emerald-600",
          },
          {
            label: "Saídas",
            value: totals.debits,
            icon: TrendingDown,
            color: "text-destructive",
          },
          {
            label: "Saldo líquido",
            value: totals.net,
            icon: Receipt,
            color: "text-primary",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="rounded-xl border border-border bg-card p-4 space-y-1"
          >
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-xl font-bold ${stat.color}`}>
              R$ {(Math.abs(stat.value) / 100).toFixed(2)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="sale">Vendas</SelectItem>
            <SelectItem value="commission">Comissões</SelectItem>
            <SelectItem value="fee">Taxas</SelectItem>
            <SelectItem value="withdrawal">Saques</SelectItem>
            <SelectItem value="refund">Reembolsos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Movimentações</h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} registro(s)
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma movimentação encontrada.
          </div>
        ) : (
          <div>
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      t.type === "credit"
                        ? "bg-emerald-500/10"
                        : "bg-destructive/10"
                    }`}
                  >
                    {t.type === "credit" ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {categoryIcons[t.category]}{" "}
                        {categoryLabels[t.category] || t.category}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[0.6rem] ${categoryColors[t.category] || ""}`}
                      >
                        {t.type === "credit" ? "Entrada" : "Saída"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
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
                  className={`text-sm font-bold whitespace-nowrap ${
                    t.type === "credit" ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {t.type === "credit" ? "+" : "-"} R${" "}
                  {(t.amount / 100).toFixed(2)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
