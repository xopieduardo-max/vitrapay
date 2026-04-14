import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowDownToLine, Loader2, CheckCircle2, XCircle, User, Banknote,
  Search, Clock, TrendingDown, Download,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const WITHDRAWAL_FEE = 500;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-accent/10 text-accent border-accent/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  completed: "Aprovado",
  rejected: "Rejeitado",
};

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const userIds = [...new Set(withdrawals.map((w) => w.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["withdrawal-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.display_name || "Usuário"]));

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed" || status === "rejected") {
        updates.processed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("withdrawals").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const payWithPix = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const { data, error } = await supabase.functions.invoke("process-withdrawal", {
        body: { withdrawal_id: withdrawalId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error + (data.details ? `: ${data.details}` : ""));
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "PIX enviado!", description: `Transfer: ${data.transfer_id}` });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar PIX", description: err.message, variant: "destructive" });
    },
  });

  // Filtering
  const filtered = useMemo(() => {
    let result = withdrawals;

    // Date filter
    if (dateRange !== "all") {
      const days = parseInt(dateRange);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      result = result.filter((w) => new Date(w.created_at) >= cutoff);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((w) => w.status === statusFilter);
    }

    // Search by user name
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((w) => (profileMap[w.user_id] || "").toLowerCase().includes(q));
    }

    return result;
  }, [withdrawals, dateRange, statusFilter, search, profileMap]);

  const pending = filtered.filter((w) => w.status === "pending" || w.status === "processing");
  const history = filtered.filter((w) => w.status === "completed" || w.status === "rejected");

  // Stats
  const totalPending = withdrawals.filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((s, w) => s + w.amount, 0);
  const totalCompleted = withdrawals.filter((w) => w.status === "completed")
    .reduce((s, w) => s + w.amount, 0);
  const totalRejected = withdrawals.filter((w) => w.status === "rejected").length;

  // CSV export
  const handleExport = () => {
    const rows = [
      ["Nome", "Status", "Valor", "Chave PIX", "Tipo Chave", "Solicitado em", "Processado em", "Transfer ID"],
      ...filtered.map((w) => [
        profileMap[w.user_id] || w.user_id,
        statusLabels[w.status] || w.status,
        (w.amount / 100).toFixed(2),
        w.pix_key || "",
        w.pix_key_type || "",
        new Date(w.created_at).toLocaleDateString("pt-BR"),
        w.processed_at ? new Date(w.processed_at).toLocaleDateString("pt-BR") : "",
        (w as any).transfer_id || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saques-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return <div className="text-center py-20 text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aprovação de Saques</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {withdrawals.filter((w) => w.status === "pending").length} pendente(s) de aprovação
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" /> A pagar
          </div>
          <p className="text-xl font-bold text-warning">{fmt(totalPending)}</p>
          <p className="text-xs text-muted-foreground">{withdrawals.filter((w) => w.status === "pending" || w.status === "processing").length} saques</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Total pago
          </div>
          <p className="text-xl font-bold text-accent">{fmt(totalCompleted)}</p>
          <p className="text-xs text-muted-foreground">{withdrawals.filter((w) => w.status === "completed").length} saques</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingDown className="h-3.5 w-3.5" /> Rejeitados
          </div>
          <p className="text-xl font-bold text-destructive">{totalRejected}</p>
          <p className="text-xs text-muted-foreground">saques rejeitados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="completed">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Pendentes ({pending.length})
          </h2>
          {pending.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{profileMap[w.user_id] || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.pix_key_type?.toUpperCase()}: {w.pix_key}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-bold">{fmt(w.amount)}</p>
                  <p className="text-[0.6rem] text-muted-foreground">
                    Taxa: {fmt(WITHDRAWAL_FEE)} • {new Date(w.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[0.6rem] ${statusColors[w.status]}`}>
                  {statusLabels[w.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2 sm:ml-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={payWithPix.isPending || !w.pix_key}
                  onClick={() => payWithPix.mutate(w.id)}
                >
                  {payWithPix.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                  Pagar PIX
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: w.id, status: "completed" })}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Manual
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: w.id, status: "rejected" })}>
                  <XCircle className="h-3.5 w-3.5" /> Rejeitar
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* History table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Histórico</h2>
          <span className="text-xs text-muted-foreground">{history.length} registro(s)</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum saque encontrado com os filtros aplicados.
          </div>
        ) : (
          <div>
            {history.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium">
                      {profileMap[w.user_id] || "Usuário"} — {fmt(w.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {w.pix_key_type?.toUpperCase()} • Processado em{" "}
                      {w.processed_at ? new Date(w.processed_at).toLocaleDateString("pt-BR") : "—"}
                      {(w as any).transfer_id && (
                        <span className="ml-2 text-primary">
                          • {(w as any).transfer_id.substring(0, 12)}…
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[0.6rem] ${statusColors[w.status]}`}>
                  {statusLabels[w.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
