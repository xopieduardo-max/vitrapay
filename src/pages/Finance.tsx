import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Wallet, ArrowDownToLine, ArrowUpRight, TrendingUp, Clock, Loader2, DollarSign,
  AlertCircle, Lock, Info,
} from "lucide-react";

// ── Platform constants ──
const HOLDBACK_DAYS_CARD = 2;   // Credit card: D+2
const HOLDBACK_DAYS_PIX = 0;    // PIX: D+0 (instant)
const MIN_WITHDRAWAL = 1000;    // R$ 10.00 in cents
const WITHDRAWAL_FEE = 500;     // R$ 5.00 in cents

function getHoldbackDays(provider: string | null) {
  return provider === "pix" ? HOLDBACK_DAYS_PIX : HOLDBACK_DAYS_CARD;
}

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function Finance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [detailView, setDetailView] = useState<"available" | "held" | null>(null);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<string>("cpf");

  // Get sales for balance calc
  const { data: sales = [] } = useQuery({
    queryKey: ["my-sales", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("amount, platform_fee, status, created_at, payment_provider")
        .eq("producer_id", user.id)
        .eq("status", "completed");
      return data || [];
    },
    enabled: !!user,
  });

  // Get commissions earned as affiliate
  const { data: commissions = [] } = useQuery({
    queryKey: ["my-commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("commissions")
        .select("amount, status, created_at")
        .eq("affiliate_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Get withdrawals
  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ["withdrawals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // ── Balance calculations ──
  const now = new Date();

  // Split sales into available vs held back
  const salesNet = sales.map((s) => ({
    net: s.amount - (s.platform_fee || 0),
    availableAt: addDays(s.created_at, getHoldbackDays(s.payment_provider)),
    provider: s.payment_provider,
  }));

  const totalAvailableSales = salesNet
    .filter((s) => s.availableAt <= now)
    .reduce((acc, s) => acc + s.net, 0);

  const totalHeldSales = salesNet
    .filter((s) => s.availableAt > now)
    .reduce((acc, s) => acc + s.net, 0);

  // Commissions — apply card holdback (conservative)
  const commissionsNet = commissions.map((c) => ({
    amount: c.amount,
    availableAt: addDays(c.created_at, HOLDBACK_DAYS_CARD),
  }));

  const totalAvailableCommissions = commissionsNet
    .filter((c) => c.availableAt <= now)
    .reduce((acc, c) => acc + c.amount, 0);

  const totalHeldCommissions = commissionsNet
    .filter((c) => c.availableAt > now)
    .reduce((acc, c) => acc + c.amount, 0);

  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((acc, w) => acc + w.amount, 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((acc, w) => acc + w.amount, 0);

  // Fees already paid
  const totalFeesPaid = withdrawals
    .filter((w) => w.status !== "rejected")
    .length * WITHDRAWAL_FEE;

  const totalAvailable = totalAvailableSales + totalAvailableCommissions;
  const totalHeld = totalHeldSales + totalHeldCommissions;
  const availableBalance = totalAvailable - totalWithdrawn - pendingWithdrawals - totalFeesPaid;
  const totalEarnings = totalAvailable + totalHeld;

  // ── Withdrawal mutation ──
  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Valor inválido");
      if (amountCents < MIN_WITHDRAWAL) throw new Error(`Saque mínimo de R$ ${(MIN_WITHDRAWAL / 100).toFixed(2)}`);
      if (amountCents + WITHDRAWAL_FEE > availableBalance) throw new Error("Saldo insuficiente (valor + taxa de R$ 5,00)");
      if (!pixKey.trim()) throw new Error("Informe a chave Pix");

      const { error } = await supabase.from("withdrawals").insert({
        user_id: user.id,
        amount: amountCents,
        pix_key: pixKey.trim(),
        pix_key_type: pixKeyType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saque solicitado!", description: `Taxa de R$ ${(WITHDRAWAL_FEE / 100).toFixed(2)} será descontada. Processaremos em até 24h.` });
      setWithdrawOpen(false);
      setAmount("");
      setPixKey("");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const parsedAmount = Math.round(parseFloat((amount || "0").replace(",", ".")) * 100);
  const netAfterFee = parsedAmount > 0 ? parsedAmount : 0;
  const totalDeducted = netAfterFee + WITHDRAWAL_FEE;

  const statusColors: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    processing: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-accent/10 text-accent border-accent/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    completed: "Concluído",
    rejected: "Rejeitado",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus ganhos e saques</p>
        </div>
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <ArrowDownToLine className="h-4 w-4" strokeWidth={1.5} />
              Solicitar Saque
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Saque via Pix</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Balance info */}
              <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Saldo disponível</span>
                  <span className="text-lg font-bold text-primary">
                    R$ {(Math.max(0, availableBalance) / 100).toFixed(2)}
                  </span>
                </div>
                {totalHeld > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Retido (PIX: D+0 • Cartão: D+{HOLDBACK_DAYS_CARD})
                    </span>
                    <span className="text-sm font-medium text-warning">
                      R$ {(totalHeld / 100).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Rules info */}
              <div className="rounded-lg border border-border p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Saque mínimo: <strong className="text-foreground">R$ {(MIN_WITHDRAWAL / 100).toFixed(2)}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Taxa por saque: <strong className="text-foreground">R$ {(WITHDRAWAL_FEE / 100).toFixed(2)}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Carência: <strong className="text-foreground">{HOLDBACK_DAYS} dias</strong> após venda confirmada</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor do saque (R$)</Label>
                <Input
                  placeholder="100,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {parsedAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Você recebe: <strong>R$ {(netAfterFee / 100).toFixed(2)}</strong> • 
                    Total debitado: <strong>R$ {(totalDeducted / 100).toFixed(2)}</strong> (inclui taxa de R$ {(WITHDRAWAL_FEE / 100).toFixed(2)})
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tipo de chave Pix</Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave Pix</Label>
                <Input
                  placeholder="Sua chave Pix"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={requestWithdrawal.isPending || parsedAmount < MIN_WITHDRAWAL}
                onClick={() => requestWithdrawal.mutate()}
              >
                {requestWithdrawal.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar Saque"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Saldo Disponível", value: Math.max(0, availableBalance), icon: Wallet, color: "text-primary", description: "Pronto para saque", clickAction: "available" as const },
          { label: "Saldo Retido", value: totalHeld, icon: Lock, color: "text-warning", description: `Liberado em ${HOLDBACK_DAYS} dias`, clickAction: "held" as const },
          { label: "Total Ganho", value: totalEarnings, icon: TrendingUp, color: "text-accent", description: "Vendas + comissões", clickAction: null },
          { label: "Total Sacado", value: totalWithdrawn, icon: DollarSign, color: "text-muted-foreground", description: "Já transferido", clickAction: null },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className={`rounded-xl border bg-card p-4 space-y-1 transition-colors ${
              stat.clickAction
                ? "cursor-pointer hover:border-primary/40 border-border"
                : "border-border"
            } ${detailView === stat.clickAction ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
            onClick={() => stat.clickAction && setDetailView(detailView === stat.clickAction ? null : stat.clickAction)}
          >
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-xl font-bold ${stat.color}`}>
              R$ {(stat.value / 100).toFixed(2)}
            </p>
            <p className="text-[0.6rem] text-muted-foreground">{stat.description}</p>
          </motion.div>
        ))}
      </div>

      {/* Available balance detail */}
      {detailView === "available" && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary/20 bg-card p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Saldo Disponível — Detalhamento
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-border pb-2">
              <span className="text-muted-foreground">Vendas liberadas (após {HOLDBACK_DAYS} dias)</span>
              <span className="font-medium text-primary">+ R$ {(totalAvailableSales / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-border pb-2">
              <span className="text-muted-foreground">Comissões liberadas</span>
              <span className="font-medium text-primary">+ R$ {(totalAvailableCommissions / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-border pb-2">
              <span className="text-muted-foreground">Saques concluídos</span>
              <span className="font-medium text-destructive">- R$ {(totalWithdrawn / 100).toFixed(2)}</span>
            </div>
            {pendingWithdrawals > 0 && (
              <div className="flex items-center justify-between text-xs border-b border-border pb-2">
                <span className="text-muted-foreground">Saques pendentes</span>
                <span className="font-medium text-warning">- R$ {(pendingWithdrawals / 100).toFixed(2)}</span>
              </div>
            )}
            {totalFeesPaid > 0 && (
              <div className="flex items-center justify-between text-xs border-b border-border pb-2">
                <span className="text-muted-foreground">Taxas de saque</span>
                <span className="font-medium text-destructive">- R$ {(totalFeesPaid / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-1 font-bold">
              <span>Saldo disponível</span>
              <span className="text-primary">R$ {(Math.max(0, availableBalance) / 100).toFixed(2)}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pending withdrawals alert */}
      {pendingWithdrawals > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <Clock className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-medium">Saque(s) em processamento</p>
            <p className="text-xs text-muted-foreground">
              R$ {(pendingWithdrawals / 100).toFixed(2)} aguardando aprovação do admin
            </p>
          </div>
        </div>
      )}

      {/* Held balance detail */}
      {totalHeld > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-warning" /> Saldo Retido — Detalhamento
          </h3>
          <div className="space-y-1.5">
            {salesNet.filter((s) => s.availableAt > now).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Liberado em {s.availableAt.toLocaleDateString("pt-BR")}
                </span>
                <span className="font-medium">R$ {(s.net / 100).toFixed(2)}</span>
              </div>
            ))}
            {commissionsNet.filter((c) => c.availableAt > now).map((c, i) => (
              <div key={`c-${i}`} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Comissão • Liberado em {c.availableAt.toLocaleDateString("pt-BR")}
                </span>
                <span className="font-medium">R$ {(c.amount / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawal history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Histórico de Saques</h2>
          <span className="text-xs text-muted-foreground">{withdrawals.length} saque(s)</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum saque realizado ainda.
          </div>
        ) : (
          <div>
            {withdrawals.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium">
                      R$ {(w.amount / 100).toFixed(2)}
                      <span className="text-xs text-muted-foreground ml-1.5">
                        (taxa: R$ {(WITHDRAWAL_FEE / 100).toFixed(2)})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {w.pix_key_type?.toUpperCase()} • {new Date(w.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[0.6rem] ${statusColors[w.status]}`}>
                  {statusLabels[w.status] || w.status}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
