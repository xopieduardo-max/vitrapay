import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Download,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarIcon,
  X,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORY_LABELS: Record<string, string> = {
  sale: "Venda",
  fee: "Taxa",
  withdrawal: "Saque",
  commission: "Comissão",
  refund: "Estorno",
  "admin-withdrawal": "Saque Admin",
  "admin-service-fee-withdrawal": "Taxa Serviço Admin",
  "admin-withdrawal-fee-withdrawal": "Taxa Saque Admin",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Concluída",
  pending: "Pendente",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function AdminTransactions() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [balanceTypeFilter, setBalanceTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Fetch fake sale IDs to exclude from admin view
  const { data: fakeSaleIds = [] } = useQuery({
    queryKey: ["admin-fake-sale-ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id")
        .like("payment_id", "fake_%");
      return (data || []).map((s: any) => s.id);
    },
  });

  const fakeSaleIdSet = useMemo(() => new Set(fakeSaleIds), [fakeSaleIds]);

  // Fetch all transactions with user info
  const { data: transactionsRaw = [], isLoading } = useQuery({
    queryKey: ["admin-all-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;
      return data || [];
    },
  });

  // Exclude transactions linked to fake sales
  const transactions = useMemo(() => {
    return transactionsRaw.filter((t: any) => {
      if (!t.reference_id) return true;
      return !fakeSaleIdSet.has(t.reference_id);
    });
  }, [transactionsRaw, fakeSaleIdSet]);

  // Fetch profiles for display names
  const userIds = useMemo(
    () => [...new Set(transactions.map((t) => t.user_id))],
    [transactions]
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-tx-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p) => (m[p.user_id] = p.display_name || "Sem nome"));
    return m;
  }, [profiles]);

  // Get unique categories for the filter
  const categories = useMemo(
    () => [...new Set(transactions.map((t) => t.category))].sort(),
    [transactions]
  );

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (balanceTypeFilter !== "all" && t.balance_type !== balanceTypeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (profileMap[t.user_id] || "").toLowerCase();
        const refId = (t.reference_id || "").toLowerCase();
        if (!name.includes(q) && !refId.includes(q) && !t.user_id.toLowerCase().includes(q)) return false;
      }
      if (dateFrom) {
        const from = startOfDay(dateFrom);
        if (new Date(t.created_at) < from) return false;
      }
      if (dateTo) {
        const to = endOfDay(dateTo);
        if (new Date(t.created_at) > to) return false;
      }
      return true;
    });
  }, [transactions, categoryFilter, typeFilter, statusFilter, balanceTypeFilter, searchQuery, profileMap, dateFrom, dateTo]);

  // Reset page when filters change
  const filterKey = `${categoryFilter}-${typeFilter}-${statusFilter}-${balanceTypeFilter}-${searchQuery}-${dateFrom?.toISOString()}-${dateTo?.toISOString()}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Stats
  const totalCredits = filtered.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebits = filtered.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);

  const exportCSV = () => {
    const header = "Data,Usuário,Tipo,Categoria,Valor,Status,Balance Type,Reference ID\n";
    const rows = filtered.map((t) => {
      const date = format(new Date(t.created_at), "dd/MM/yyyy HH:mm");
      const name = profileMap[t.user_id] || t.user_id;
      const value = (t.amount / 100).toFixed(2).replace(".", ",");
      return `${date},"${name}",${t.type},${t.category},${value},${t.status},${t.balance_type},${t.reference_id || ""}`;
    });
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Transações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} transações encontradas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Créditos</p>
              <p className="text-lg font-bold text-foreground">
                R$ {(totalCredits / 100).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <ArrowUpRight className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Débitos</p>
              <p className="text-lg font-bold text-foreground">
                R$ {(totalDebits / 100).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Líquido</p>
              <p className="text-lg font-bold text-foreground">
                R$ {((totalCredits - totalDebits) / 100).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário ou ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c] || c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
                <SelectItem value="debit">Débito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
            <Select value={balanceTypeFilter} onValueChange={setBalanceTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Saldo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos saldos</SelectItem>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left text-xs font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left text-xs font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar datas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhuma transação encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(t.created_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm max-w-[140px] truncate">
                        {profileMap[t.user_id] || t.user_id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {t.type === "credit" ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className="text-xs">
                            {t.type === "credit" ? "Crédito" : "Débito"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {CATEGORY_LABELS[t.category] || t.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className={t.type === "credit" ? "text-emerald-600" : "text-red-500"}>
                          {t.type === "credit" ? "+" : "-"}R$ {(t.amount / 100).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-normal ${
                            t.balance_type === "available"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {t.balance_type === "available" ? "Disponível" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-normal ${STATUS_COLORS[t.status] || ""}`}
                        >
                          {STATUS_LABELS[t.status] || t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[100px] truncate">
                        {t.reference_id ? t.reference_id.substring(0, 8) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
