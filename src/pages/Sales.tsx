import { useState, useMemo } from "react";
import { ExportButton } from "@/components/ExportButton";
import { DollarSign, ShoppingCart, CreditCard, Loader2, Calendar, Percent, User, Mail, FileText, Search, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [productFilter, setProductFilter] = useState("all");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);

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

  const uniqueProducts = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach((s: any) => {
      if (s.product_id && s.products?.title) {
        map.set(s.product_id, s.products.title);
      }
    });
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((s: any) => {
      if (productFilter !== "all" && s.product_id !== productFilter) return false;
      const startDate = getFilterDate(dateFilter);
      const endDate = getFilterEndDate(dateFilter);
      if (startDate) {
        const saleDate = new Date(s.created_at);
        if (endDate) { if (saleDate < startDate || saleDate >= endDate) return false; }
        else { if (saleDate < startDate) return false; }
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const title = (s.products?.title || "").toLowerCase();
        const id = s.id.toLowerCase();
        const buyerName = ((buyerProfiles as Record<string, string>)[s.buyer_id] || "").toLowerCase();
        if (!title.includes(term) && !id.includes(term) && !buyerName.includes(term)) return false;
      }
      return true;
    });
  }, [sales, productFilter, dateFilter, searchTerm, buyerProfiles]);

  const completed = filteredSales.filter((s: any) => s.status === "completed");
  const pending = filteredSales.filter((s: any) => s.status === "pending");
  const totalRevenue = completed.reduce((acc: number, s: any) => acc + s.amount, 0);
  const pendingRevenue = pending.reduce((acc: number, s: any) => acc + s.amount, 0);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / perPage));
  const paginatedSales = filteredSales.slice((page - 1) * perPage, page * perPage);

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { setPage(1); }, [dateFilter, productFilter, searchTerm]);

  // Chart data: group by day for last 7 days
  const chartData = useMemo(() => {
    const days = 7;
    const now = new Date();
    const buckets: { label: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = sales.filter((s: any) => {
        if (s.status !== "completed") return false;
        const sd = new Date(s.created_at);
        return sd >= start && sd < end;
      }).length;
      buckets.push({ label: dayStr, value: count });
    }
    return buckets;
  }, [sales]);

  const maxChart = Math.max(1, ...chartData.map((d) => d.value));

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
    status: s.status === "completed" ? "Pago" : s.status === "pending" ? "Pendente" : s.status === "refunded" ? "Reembolsado" : s.status,
    payment_provider: s.payment_provider || "N/A",
    created_at: new Date(s.created_at).toLocaleDateString("pt-BR"),
  }));

  const statusMap: Record<string, { label: string; className: string }> = {
    completed: { label: "Pago", className: "bg-primary/10 text-primary border-primary/20" },
    pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Minhas vendas</h1>
        <div className="flex items-center gap-3">
          <ExportButton data={exportData} columns={exportColumns} filename="vendas-vitrapay" />
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-card border-border"
          />
        </div>

        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtrar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-4" align="start">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <div className="flex flex-wrap gap-1.5">
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setDateFilter(f.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      dateFilter === f.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Produto</label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {uniqueProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <span>Itens por página:</span>
          <Select value={perPage.toString()} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-[70px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart + Side Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-end justify-between h-[200px] gap-2">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between h-full text-xs text-muted-foreground pr-2 py-1">
              <span>{maxChart}</span>
              <span>{Math.round(maxChart / 2)}</span>
              <span>0</span>
            </div>
            {/* Bars */}
            <div className="flex-1 flex items-end justify-between gap-1 h-full">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.value / maxChart) * 100}%` }}
                    transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
                    className="w-full max-w-[40px] bg-primary/20 rounded-t-md relative min-h-[2px]"
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t-md bg-primary"
                      style={{ height: "100%" }}
                    />
                  </motion.div>
                  <span className="text-[0.6rem] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side Stat Cards */}
        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-5 flex-1"
          >
            <p className="text-sm font-semibold text-emerald-500">Vendas aprovadas</p>
            <p className="text-2xl font-bold mt-1">
              R$ {(totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{completed.length} transações</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-5 flex-1"
          >
            <p className="text-sm font-semibold text-amber-500">Aguardando pagamento</p>
            <p className="text-2xl font-bold mt-1">
              R$ {(pendingRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{pending.length} transações</p>
          </motion.div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[80px_1fr_1fr_100px_100px_100px_80px_80px] gap-2 px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground">
          <span>Id</span>
          <span>Comprador</span>
          <span>Produto</span>
          <span>Data</span>
          <span>Pagamento</span>
          <span className="text-right">Valor</span>
          <span className="text-center">Status</span>
          <span className="text-right">Hora</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedSales.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paginatedSales.map((sale: any, i: number) => {
              const st = statusMap[sale.status] || statusMap.pending;
              const saleDate = new Date(sale.created_at);
              const buyerName = (buyerProfiles as Record<string, string>)[sale.buyer_id] || "—";

              return (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[80px_1fr_1fr_100px_100px_100px_80px_80px] gap-2 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer items-center text-sm"
                  onClick={() => setSelectedSale(sale)}
                >
                  <span className="text-xs font-mono text-muted-foreground truncate">
                    {sale.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="truncate">{buyerName}</span>
                  <span className="truncate">{sale.products?.title || "Produto removido"}</span>
                  <span className="text-xs text-muted-foreground">
                    {saleDate.toLocaleDateString("pt-BR")}
                  </span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {sale.payment_provider || "—"}
                  </span>
                  <span className="text-right font-semibold">
                    R$ {(sale.amount / 100).toFixed(2)}
                  </span>
                  <span className="text-center">
                    <Badge variant="secondary" className={`text-[0.6rem] ${st.className}`}>
                      {st.label}
                    </Badge>
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {timeAgo(sale.created_at)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <span className="text-muted-foreground text-xs">
          Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
                      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5" /> Pagamento
                  </span>
                  <span className="text-sm font-medium capitalize">{selectedSale.payment_provider || "N/A"}</span>
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
                    <span className="text-xs font-mono text-muted-foreground">{selectedSale.payment_id.slice(0, 20)}</span>
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
