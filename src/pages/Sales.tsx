import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { ExportButton } from "@/components/ExportButton";
import { DollarSign, ShoppingCart, Percent, TrendingUp, Loader2, Calendar, CreditCard, User, Mail, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DATE_FILTERS = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "Tudo", value: "all" },
];

function getFilterDate(filter: string): Date | null {
  const now = new Date();
  switch (filter) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "yesterday": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - 1);
      return d;
    }
    case "7d": {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "30d": {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    }
    default:
      return null;
  }
}

function getFilterEndDate(filter: string): Date | null {
  if (filter === "yesterday") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return null;
}

export default function Sales() {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedSale, setSelectedSale] = useState<any>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-stats", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("id, amount, platform_fee, status, created_at, payment_provider, payment_id, product_id, buyer_id, products(title)")
        .eq("producer_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch buyer profiles for detail view
  const { data: buyerProfiles = {} } = useQuery({
    queryKey: ["buyer-profiles", sales.map((s: any) => s.buyer_id).filter(Boolean)],
    queryFn: async () => {
      const buyerIds = [...new Set(sales.map((s: any) => s.buyer_id).filter(Boolean))];
      if (buyerIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", buyerIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.display_name || ""; });
      return map;
    },
    enabled: sales.length > 0,
  });

  // Apply date filter
  const filteredSales = sales.filter((s: any) => {
    const startDate = getFilterDate(dateFilter);
    const endDate = getFilterEndDate(dateFilter);
    if (!startDate) return true;
    const saleDate = new Date(s.created_at);
    if (endDate) return saleDate >= startDate && saleDate < endDate;
    return saleDate >= startDate;
  });

  const completed = filteredSales.filter((s: any) => s.status === "completed");
  const totalRevenue = completed.reduce((acc: number, s: any) => acc + s.amount, 0);
  const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0;

  const salesStats = [
    {
      title: "Receita Total",
      value: `R$ ${(totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      change: `${completed.length} vendas concluídas`,
      changeType: "positive" as const,
      icon: DollarSign,
    },
    {
      title: "Total de Vendas",
      value: filteredSales.length.toString(),
      change: "Todas as vendas",
      changeType: "positive" as const,
      icon: ShoppingCart,
    },
    {
      title: "Taxa de Conversão",
      value: filteredSales.length > 0 ? `${((completed.length / filteredSales.length) * 100).toFixed(1)}%` : "0%",
      change: "Vendas concluídas / total",
      changeType: "neutral" as const,
      icon: Percent,
    },
    {
      title: "Ticket Médio",
      value: `R$ ${(avgTicket / 100).toFixed(2)}`,
      change: "Valor médio por venda",
      changeType: "neutral" as const,
      icon: TrendingUp,
    },
  ];

  const exportColumns = [
    { key: "product_title", label: "Produto" },
    { key: "amount_formatted", label: "Valor (R$)" },
    { key: "status", label: "Status" },
    { key: "payment_provider", label: "Pagamento" },
    { key: "created_at", label: "Data" },
  ];

  const exportData = filteredSales.map((s: any) => ({
    product_title: s.products?.title || "Produto removido",
    amount_formatted: (s.amount / 100).toFixed(2),
    status: s.status === "completed" ? "Pago" : s.status === "pending" ? "Pendente" : s.status,
    payment_provider: s.payment_provider || "N/A",
    created_at: new Date(s.created_at).toLocaleDateString("pt-BR"),
  }));

  const statusMap: Record<string, { label: string; className: string }> = {
    completed: { label: "Pago", className: "bg-primary/10 text-primary border-primary/20" },
    pending: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/20" },
    refunded: { label: "Reembolsado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `Há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Há ${days}d`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minhas Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe suas vendas e métricas de conversão
          </p>
        </div>
        <ExportButton data={exportData} columns={exportColumns} filename="vendas-vitrapay" />
      </div>

      {/* Date Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {DATE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setDateFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              dateFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {salesStats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>

      {/* Sales List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Vendas ({filteredSales.length})</h3>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma venda encontrada neste período.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredSales.map((sale: any, i: number) => {
              const st = statusMap[sale.status] || statusMap.pending;
              return (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.4, ease: [0.2, 0, 0, 1] }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedSale(sale)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {sale.products?.title || "Produto removido"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sale.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge variant="secondary" className={`text-[0.6rem] ${st.className}`}>
                      {st.label}
                    </Badge>
                    <span className="text-sm font-semibold min-w-[80px] text-right">
                      R$ {(sale.amount / 100).toFixed(2)}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground min-w-[60px] text-right hidden sm:block">
                      {timeAgo(sale.created_at)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{selectedSale.products?.title || "Produto removido"}</p>
                    <p className="text-xs text-muted-foreground">ID: {selectedSale.id.slice(0, 12).toUpperCase()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5" /> Valor
                  </span>
                  <span className="text-sm font-bold">R$ {(selectedSale.amount / 100).toFixed(2)}</span>
                </div>

                {selectedSale.platform_fee > 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Percent className="h-3.5 w-3.5" /> Taxa plataforma
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">R$ {(selectedSale.platform_fee / 100).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> Data
                  </span>
                  <span className="text-sm font-medium">
                    {new Date(selectedSale.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5" /> Pagamento
                  </span>
                  <span className="text-sm font-medium capitalize">
                    {selectedSale.payment_provider || "N/A"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <ShoppingCart className="h-3.5 w-3.5" /> Status
                  </span>
                  <Badge variant="secondary" className={`text-[0.65rem] ${(statusMap[selectedSale.status] || statusMap.pending).className}`}>
                    {(statusMap[selectedSale.status] || statusMap.pending).label}
                  </Badge>
                </div>

                {selectedSale.buyer_id && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <User className="h-3.5 w-3.5" /> Cliente
                    </span>
                    <span className="text-sm font-medium">
                      {(buyerProfiles as Record<string, string>)[selectedSale.buyer_id] || selectedSale.buyer_id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                )}

                {selectedSale.payment_id && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> ID Pagamento
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {selectedSale.payment_id.slice(0, 20)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
