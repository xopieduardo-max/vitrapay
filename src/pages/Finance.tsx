import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle, Lock, Info, ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2,
} from "lucide-react";

// ── Platform constants ──
const HOLDBACK_DAYS_PIX = 0;    // PIX: D+0 (instant)
const MIN_WITHDRAWAL = 1000;    // R$ 10.00 in cents
const WITHDRAWAL_FEE = 500;     // R$ 5.00 in cents
const AUTO_APPROVE_LIMIT = 10000; // R$ 100.00 — auto PIX

function getHoldbackDays(provider: string | null, cardHoldDays: number) {
  return provider === "pix" ? HOLDBACK_DAYS_PIX : cardHoldDays;
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
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [detailView, setDetailView] = useState<"available" | "held" | null>(null);
  const [amount, setAmount] = useState("");

  // Get saved pix key from profile
  const { data: profile } = useQuery({
    queryKey: ["profile-finance", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("pix_key, pix_key_type, cpf, phone, display_name, address_cep, card_plan")
        .eq("user_id", user.id)
        .single();
      return data as any;
    },
    enabled: !!user,
  });

  // Get wallet balance (server-side calculated, prevents plan-switching exploits)
  const { data: wallet } = useQuery({
    queryKey: ["finance-wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("wallets")
        .select("balance_available, balance_pending, balance_total")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const pixKey = profile?.pix_key || "";
  const pixKeyType = profile?.pix_key_type || "cpf";
  const profileIncomplete = !profile?.cpf || !profile?.phone || !profile?.display_name;

  // Get sales for balance calc
  const { data: sales = [] } = useQuery({
    queryKey: ["my-sales", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("amount, platform_fee, status, created_at, payment_provider, payment_id")
        .eq("producer_id", user.id)
        .eq("status", "completed");
      return data || [];
    },
    enabled: !!user,
  });

  const paymentIds = useMemo(
    () => [...new Set(sales.map((sale: any) => sale.payment_id).filter(Boolean))],
    [sales]
  );

  const { data: confirmedPaymentIds = [] } = useQuery({
    queryKey: ["confirmed-sales", paymentIds],
    queryFn: async () => {
      if (paymentIds.length === 0) return [];
      const { data } = await supabase
        .from("pending_payments")
        .select("asaas_payment_id")
        .in("asaas_payment_id", paymentIds)
        .eq("status", "confirmed");
      return (data || []).map((payment: any) => payment.asaas_payment_id);
    },
    enabled: paymentIds.length > 0,
  });

  const verifiedSales = useMemo(() => {
    const validIds = new Set(confirmedPaymentIds);
    return sales.filter((sale: any) => sale.payment_id && validIds.has(sale.payment_id));
  }, [sales, confirmedPaymentIds]);

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

  // ── Balance calculations (use wallet as source of truth) ──
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((acc, w) => acc + w.amount, 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((acc, w) => acc + w.amount, 0);

  const availableBalance = wallet?.balance_available ?? 0;
  const totalHeld = wallet?.balance_pending ?? 0;
  const totalEarnings = (wallet?.balance_total ?? 0) + totalWithdrawn;

  const cardPlan = profile?.card_plan || "d30";
  const HOLDBACK_DAYS_CARD_LABEL = cardPlan === "d2" ? 2 : 30;

  // ── Withdrawal mutation (uses edge function) ──
  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Valor inválido");
      if (amountCents < MIN_WITHDRAWAL) throw new Error(`Saque mínimo de R$ ${(MIN_WITHDRAWAL / 100).toFixed(2)}`);
      if (amountCents + WITHDRAWAL_FEE > availableBalance) throw new Error("Saldo insuficiente (valor + taxa de R$ 5,00)");
      if (!pixKey.trim()) throw new Error("Configure sua chave Pix em Ajustes");

      const { data, error } = await supabase.functions.invoke("request-withdraw", {
        body: {
          amount: amountCents,
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const description = data?.auto_processed
        ? `PIX enviado automaticamente! Transfer: ${data.transfer_id?.substring(0, 12)}…`
        : data?.message || `Saque criado. Aguardando aprovação do administrador.`;
      toast({ title: "Saque solicitado!", description });
      setWithdrawOpen(false);
      setAmount("");
      setWithdrawStep(1);
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
        <Dialog open={withdrawOpen} onOpenChange={(open) => {
          setWithdrawOpen(open);
          if (!open) { setWithdrawStep(1); setAmount(""); }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <ArrowDownToLine className="h-4 w-4" strokeWidth={1.5} />
              Solicitar Saque
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Solicitar saque</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {withdrawStep === 1
                  ? "Quase lá! Informe o valor e siga para a próxima etapa."
                  : 'Se estiver tudo certo, clique em "Solicitar saque" para concluir.'}
              </p>
            </DialogHeader>

            {/* Progress bar */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: withdrawStep === 1 ? "50%" : "100%" }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{withdrawStep} de 2</span>
            </div>

            {withdrawStep === 1 ? (
              /* ── Step 1: Amount ── */
              <div className="space-y-6 pt-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Quanto você quer sacar? <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                    <span className="px-3 text-sm text-muted-foreground font-medium bg-muted/50 h-10 flex items-center border-r border-input">
                      R$
                    </span>
                    <Input
                      placeholder="100,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>

                {/* Balance info at bottom */}
                <div className="rounded-lg border border-border p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Saldo disponível</span>
                  <span className="text-sm font-bold">
                    R$ {(Math.max(0, availableBalance) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {profileIncomplete && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                    <Lock className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Para solicitar saques, complete seu cadastro (nome, CPF e telefone) em <strong>Ajustes</strong>.
                    </p>
                  </div>
                )}

                {!profileIncomplete && !pixKey && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Você ainda não configurou sua chave Pix. Vá em <strong>Ajustes</strong> para cadastrar.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setWithdrawOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    disabled={parsedAmount < MIN_WITHDRAWAL || !pixKey || profileIncomplete}
                    onClick={() => setWithdrawStep(2)}
                  >
                    Prosseguir
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Step 2: Confirmation ── */
              <div className="space-y-6 pt-2">
                <div className="rounded-lg border border-border divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Chave Pix</span>
                    <span className="text-sm font-medium">{pixKey}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Valor a sacar</span>
                    <span className="text-sm font-medium">
                      R$ {(parsedAmount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Taxa</span>
                    <span className="text-sm font-medium">
                      R$ {(WITHDRAWAL_FEE / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Valor a receber</span>
                    <span className="text-sm font-bold text-primary">
                      R$ {(netAfterFee / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 p-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    A VitraPay prioriza a segurança e analisa seu saque
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => setWithdrawStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    disabled={requestWithdrawal.isPending}
                    onClick={() => requestWithdrawal.mutate()}
                  >
                    {requestWithdrawal.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Saldo Disponível", value: Math.max(0, availableBalance), icon: Wallet, color: "text-emerald-500", cardClass: "border-emerald-500/30 bg-emerald-500/5", description: "Pronto para saque", clickAction: "available" as const },
          { label: "Saldo Retido", value: totalHeld, icon: Lock, color: "text-warning", cardClass: "", description: `Cartão: D+${HOLDBACK_DAYS_CARD_LABEL} • PIX: D+0`, clickAction: "held" as const },
          { label: "Total Ganho", value: totalEarnings, icon: TrendingUp, color: "text-accent", cardClass: "", description: "Vendas + comissões", clickAction: null },
          { label: "Total Sacado", value: totalWithdrawn, icon: DollarSign, color: "text-muted-foreground", cardClass: "", description: "Já transferido", clickAction: null },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className={`rounded-xl border p-4 space-y-1 transition-colors ${
              stat.cardClass || "bg-card border-border"
            } ${
              stat.clickAction
                ? "cursor-pointer hover:border-primary/40"
                : ""
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
              <span className="text-muted-foreground">Saldo disponível (carteira)</span>
              <span className="font-medium text-primary">R$ {(availableBalance / 100).toFixed(2)}</span>
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
            <Lock className="h-4 w-4 text-warning" /> Saldo Retido
          </h3>
          <p className="text-xs text-muted-foreground">
            R$ {(totalHeld / 100).toFixed(2)} aguardando liberação conforme prazo do plano de recebimento.
          </p>
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
