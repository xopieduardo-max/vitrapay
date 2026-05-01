import React, { useState } from "react";
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
  QrCode, Copy, Check, Receipt, RotateCcw, Percent, Star, Eye, EyeOff,
} from "lucide-react";

// ── Platform constants ──
const MIN_WITHDRAWAL = 1000;
const WITHDRAWAL_FEE = 500;
const AUTO_APPROVE_LIMIT = 10000;

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 10 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.4, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

export default function Finance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [txLimit, setTxLimit] = useState(20);
  const [showValues, setShowValues] = useState(true);

  // ── Gerar Pix Avulso ──
  const [pixOpen, setPixOpen] = useState(false);
  const [pixAmount, setPixAmount] = useState("");
  const [pixDesc, setPixDesc] = useState("");
  const [pixResult, setPixResult] = useState<{ qrCode: string; copyPaste: string; value: number; dueDate: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixGenerating, setPixGenerating] = useState(false);

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

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page } = await supabase
          .from("transactions")
          .select("id, type, category, amount, balance_type, status, release_date, created_at, reference_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (!page || page.length === 0) break;
        allData.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      const data = allData;
      return data || [];
    },
    enabled: !!user,
  });

  // ── Balance calculations ──
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((acc, w) => acc + Number(w.amount), 0);
  const WITHDRAWABLE_CREDIT_CATEGORIES = new Set(["sale", "commission"]);
  const BALANCE_DEBIT_CATEGORIES = new Set(["refund", "chargeback", "med", "admin-withdrawal", "admin-service-fee-withdrawal"]);
  const releasedCredits = transactions
    .filter((tx) => tx.type === "credit" && tx.status === "completed" && tx.balance_type === "available" && WITHDRAWABLE_CREDIT_CATEGORIES.has(tx.category))
    .reduce((acc, tx) => acc + Number(tx.amount), 0);
  const pendingCredits = transactions
    .filter((tx) => tx.type === "credit" && tx.status === "pending" && tx.balance_type === "pending" && WITHDRAWABLE_CREDIT_CATEGORIES.has(tx.category))
    .reduce((acc, tx) => acc + Number(tx.amount), 0);
  const balanceDebits = transactions
    .filter((tx) => tx.type === "debit" && tx.status === "completed" && BALANCE_DEBIT_CATEGORIES.has(tx.category))
    .reduce((acc, tx) => acc + Number(tx.amount), 0);
  const withdrawalReservations = withdrawals
    .filter((w) => w.status === "completed" || w.status === "pending" || w.status === "processing")
    .reduce((acc, w) => acc + Number(w.amount) + WITHDRAWAL_FEE, 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((acc, w) => acc + Number(w.amount) + WITHDRAWAL_FEE, 0);

  const walletAvailableBalance = Math.max(0, releasedCredits - balanceDebits);
  const availableBalance = Math.max(0, releasedCredits - balanceDebits - withdrawalReservations);
  const totalHeld = pendingCredits;
  const totalEarnings = releasedCredits + pendingCredits;

  const cardPlan = profile?.card_plan || "d30";
  const HOLDBACK_DAYS_CARD_LABEL = cardPlan === "d2" ? 2 : 30;

  const parsedAmount = Math.round(parseFloat((amount || "0").replace(",", ".")) * 100);
  const netAfterFee = parsedAmount > 0 ? Math.max(0, parsedAmount - WITHDRAWAL_FEE) : 0;

  const fmt = (v: number) => showValues
    ? `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "R$ •••••";

  // ── Withdrawal mutation ──
  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error("Valor inválido");
      if (parsedAmount < MIN_WITHDRAWAL) throw new Error(`Saque mínimo de R$ ${(MIN_WITHDRAWAL / 100).toFixed(2)}`);
      if (parsedAmount > availableBalance) {
        throw new Error(
          availableBalance > 0
            ? `Saldo disponível para novo saque: R$ ${(availableBalance / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : "Você já possui um saque pendente em análise. Aguarde a conclusão para solicitar outro saque."
        );
      }
      if (netAfterFee <= 0) throw new Error("O valor do saque precisa ser maior que a taxa de R$ 5,00");
      if (!pixKey.trim()) throw new Error("Configure sua chave Pix em Ajustes");

      const { data, error } = await supabase.functions.invoke("request-withdraw", {
        body: { amount: netAfterFee, pix_key: pixKey.trim(), pix_key_type: pixKeyType },
      });
      if (error) {
        try {
          const errorBody = error.context ? await error.context.json() : null;
          if (errorBody?.error) throw new Error(errorBody.error);
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
        }
        throw new Error(error.message || "Erro ao processar saque");
      }
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

  async function handleGeneratePix() {
    const parsedPixAmount = Math.round(parseFloat((pixAmount || "0").replace(",", ".")) * 100);
    if (isNaN(parsedPixAmount) || parsedPixAmount < 100) {
      toast({ title: "Valor inválido", description: "Informe um valor de pelo menos R$ 1,00.", variant: "destructive" });
      return;
    }
    setPixGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-avulso", {
        body: { amount: parsedPixAmount, description: pixDesc.trim() || undefined },
      });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error || error.message || "Erro ao gerar Pix");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.pix_copy_paste) throw new Error("QR Code não retornado pelo gateway");
      setPixResult({ qrCode: data.pix_qr_code || "", copyPaste: data.pix_copy_paste, value: data.value, dueDate: data.due_date });
    } catch (err: any) {
      toast({ title: "Erro ao gerar Pix", description: err.message, variant: "destructive" });
    } finally {
      setPixGenerating(false);
    }
  }

  function handleCopyPix() {
    if (!pixResult) return;
    navigator.clipboard.writeText(pixResult.copyPaste);
    setPixCopied(true);
    toast({ title: "Copiado!", description: "Código Pix copiado para a área de transferência." });
    setTimeout(() => setPixCopied(false), 3000);
  }

  function handlePixDialogClose(open: boolean) {
    setPixOpen(open);
    if (!open) { setPixAmount(""); setPixDesc(""); setPixResult(null); setPixCopied(false); }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-primary/10 text-primary border-primary/20",
    processing: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    completed: "Concluído",
    rejected: "Rejeitado",
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div {...anim(0)} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowValues(!showValues)}>
            {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          {/* Gerar Pix Avulso */}
          <Dialog open={pixOpen} onOpenChange={handlePixDialogClose}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                <QrCode className="h-3.5 w-3.5" strokeWidth={1.5} />
                Gerar Pix
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Gerar Pix Avulso</DialogTitle>
                <p className="text-sm text-muted-foreground">Gere um QR Code Pix para enviar diretamente ao seu cliente.</p>
              </DialogHeader>
              {!pixResult ? (
                <div className="space-y-5 pt-1">
                  <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Valor informado</span>
                      <span className="text-xs font-medium">R$ {pixAmount ? parseFloat((pixAmount || "0").replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}</span>
                    </div>
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Taxa de serviço (cliente paga)</span>
                      <span className="text-xs text-muted-foreground">+ R$ 0,99</span>
                    </div>
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Taxa da plataforma (Pix)</span>
                      <span className="text-xs text-muted-foreground">- R$ 2,49</span>
                    </div>
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold">Você recebe</span>
                      <span className="text-xs font-bold text-primary">R$ {pixAmount ? Math.max(0, parseFloat((pixAmount || "0").replace(",", ".")) - 2.49).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Valor <span className="text-destructive">*</span></Label>
                    <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                      <span className="px-3 text-sm text-muted-foreground font-medium bg-muted/50 h-10 flex items-center border-r border-input">R$</span>
                      <Input placeholder="50,00" value={pixAmount} onChange={(e) => setPixAmount(e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Descrição <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
                    <Input placeholder="Ex: Consultoria, Produto X..." value={pixDesc} onChange={(e) => setPixDesc(e.target.value)} maxLength={72} />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" className="flex-1" onClick={() => setPixOpen(false)}>Cancelar</Button>
                    <Button className="flex-1 gap-2" disabled={!pixAmount || pixGenerating} onClick={handleGeneratePix}>
                      {pixGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><QrCode className="h-4 w-4" />Gerar Pix</>}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 pt-1">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-2xl border border-border p-4 bg-white">
                      {pixResult.qrCode ? (
                        <img src={`data:image/png;base64,${pixResult.qrCode}`} alt="QR Code Pix" className="w-52 h-52 rounded-lg" />
                      ) : (
                        <div className="w-52 h-52 flex items-center justify-center text-muted-foreground text-xs">QR Code indisponível</div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">R$ {pixResult.value?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      {pixResult.dueDate && <p className="text-xs text-muted-foreground mt-0.5">Válido até {new Date(pixResult.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
                      {pixDesc && <p className="text-xs text-muted-foreground mt-0.5">{pixDesc}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Código Pix (copia e cola)</Label>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground break-all leading-relaxed max-h-20 overflow-y-auto">{pixResult.copyPaste}</div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => setPixResult(null)}>Gerar Novo</Button>
                    <Button className="flex-1 gap-2" onClick={handleCopyPix}>
                      {pixCopied ? <><Check className="h-4 w-4" />Copiado!</> : <><Copy className="h-4 w-4" />Copiar Código</>}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Solicitar Saque */}
          <Dialog open={withdrawOpen} onOpenChange={(open) => { setWithdrawOpen(open); if (!open) { setWithdrawStep(1); setAmount(""); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 h-8 text-xs">
                <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.5} />
                Solicitar Saque
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Solicitar saque</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {withdrawStep === 1 ? "Quase lá! Informe o valor e siga para a próxima etapa." : 'Se estiver tudo certo, clique em "Confirmar" para concluir.'}
                </p>
              </DialogHeader>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: withdrawStep === 1 ? "50%" : "100%" }} />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{withdrawStep} de 2</span>
              </div>
              {withdrawStep === 1 ? (
                <div className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quanto você quer sacar? <span className="text-destructive">*</span></Label>
                    <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                      <span className="px-3 text-sm text-muted-foreground font-medium bg-muted/50 h-10 flex items-center border-r border-input">R$</span>
                      <Input placeholder="100,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Disponível para novo saque</span>
                    <span className="text-sm font-bold">R$ {(availableBalance / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {pendingWithdrawals > 0 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
                      <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">Você já possui <strong>R$ {(pendingWithdrawals / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> reservados em saque pendente.</p>
                    </div>
                  )}
                  {profileIncomplete && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                      <Lock className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">Complete seu cadastro (nome, CPF e telefone) em <strong>Ajustes</strong>.</p>
                    </div>
                  )}
                  {!profileIncomplete && !pixKey && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">Configure sua chave Pix em <strong>Ajustes</strong>.</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setWithdrawOpen(false)}>Cancelar</Button>
                    <Button className="flex-1 gap-2" disabled={parsedAmount < MIN_WITHDRAWAL || parsedAmount > availableBalance || !pixKey || profileIncomplete} onClick={() => setWithdrawStep(2)}>
                      Prosseguir <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  <div className="rounded-lg border border-border divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Chave Pix</span>
                      <span className="text-sm font-medium">{pixKey}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Valor a sacar</span>
                      <span className="text-sm font-medium">R$ {(parsedAmount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Taxa</span>
                      <span className="text-sm font-medium">R$ {(WITHDRAWAL_FEE / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Valor a receber</span>
                      <span className="text-sm font-bold text-primary">R$ {(netAfterFee / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">A VitraPay prioriza a segurança e analisa seu saque</span>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => setWithdrawStep(1)}><ArrowLeft className="h-4 w-4" />Voltar</Button>
                    <Button className="flex-1 gap-2" disabled={requestWithdrawal.isPending} onClick={() => requestWithdrawal.mutate()}>
                      {requestWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" />Confirmar</>}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Row 1: Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Saldo Disponível", value: availableBalance, icon: Wallet, accent: true, sub: pendingWithdrawals > 0 ? "Já desconta saques pendentes" : "Pronto para saque" },
          { label: "Saldo Retido", value: totalHeld, icon: Lock, accent: false, sub: `Cartão: D+${HOLDBACK_DAYS_CARD_LABEL} • PIX: D+0` },
          { label: "Total Ganho", value: totalEarnings, icon: TrendingUp, accent: false, sub: "Vendas + comissões" },
          { label: "Total Sacado", value: totalWithdrawn, icon: DollarSign, accent: false, sub: "Já transferido via PIX" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            {...anim(0.05 + i * 0.05)}
            className={`rounded-xl border p-5 ${stat.accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.accent ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.accent ? "text-primary" : "text-foreground"}`}>{fmt(stat.value)}</p>
            <p className="text-[0.6rem] text-muted-foreground mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Balance Composition + Pending Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div {...anim(0.25)} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-xs text-muted-foreground flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-primary" /> Composição do saldo
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Saldo na carteira</span>
              </div>
              <span className="font-semibold">{fmt(walletAvailableBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-muted-foreground">Reservado em saques</span>
              </div>
              <span className={`font-semibold ${pendingWithdrawals > 0 ? "text-destructive" : ""}`}>
                {pendingWithdrawals > 0 ? "- " : ""}{fmt(pendingWithdrawals)}
              </span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm font-semibold">Disponível para saque</span>
              </div>
              <span className="text-lg font-bold text-primary">{fmt(availableBalance)}</span>
            </div>
          </div>
        </motion.div>

        {/* Held balance + pending info */}
        <motion.div {...anim(0.3)} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-xs text-muted-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-primary" /> Informações de retenção
          </h3>
          {totalHeld > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm text-muted-foreground">Saldo retido</span>
              <span className="text-sm font-bold">{fmt(totalHeld)}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vendas via <strong>cartão</strong> ficam retidas por <strong>D+{HOLDBACK_DAYS_CARD_LABEL}</strong> antes de serem liberadas para saque. Vendas via <strong>PIX</strong> são liberadas imediatamente (D+0).
          </p>
          {pendingWithdrawals > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium">Saque em processamento</p>
                <p className="text-[0.6rem] text-muted-foreground">{fmt(pendingWithdrawals)} aguardando aprovação</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Row 3: Extrato de Movimentações */}
      {(() => {
        const txCategoryConfig: Record<string, { label: string; icon: React.ReactNode; colorClass: string }> = {
          sale:                    { label: "Venda",               icon: <TrendingUp className="h-4 w-4" />,    colorClass: "text-emerald-500 bg-emerald-500/10" },
          commission:              { label: "Comissão",            icon: <Star className="h-4 w-4" />,          colorClass: "text-emerald-500 bg-emerald-500/10" },
          fee:                     { label: "Taxa plataforma",     icon: <Percent className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
          withdrawal:              { label: "Saque",               icon: <ArrowDownToLine className="h-4 w-4" />, colorClass: "text-primary bg-primary/10" },
          refund:                  { label: "Estorno",             icon: <RotateCcw className="h-4 w-4" />,     colorClass: "text-destructive bg-destructive/10" },
          chargeback:              { label: "Chargeback",          icon: <AlertCircle className="h-4 w-4" />,   colorClass: "text-destructive bg-destructive/10" },
          med:                     { label: "MED Pix",             icon: <AlertCircle className="h-4 w-4" />,   colorClass: "text-destructive bg-destructive/10" },
          service_fee:             { label: "Taxa de serviço",     icon: <Percent className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
          "admin-withdrawal":      { label: "Ajuste admin",        icon: <Receipt className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
          "admin-service-fee-withdrawal": { label: "Ajuste admin", icon: <Receipt className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
        };

        const filtered = transactions.filter((tx) => txFilter === "all" ? true : tx.type === txFilter);
        const visible = filtered.slice(0, txLimit);
        const hasMore = filtered.length > txLimit;

        return (
          <motion.div {...anim(0.35)} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">Extrato de Movimentações</h2>
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                {(["all", "credit", "debit"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setTxFilter(f); setTxLimit(20); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      txFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "Todos" : f === "credit" ? "Entradas" : "Saídas"}
                  </button>
                ))}
              </div>
            </div>

            {txLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação encontrada.</div>
            ) : (
              <>
                <div>
                  {visible.map((tx: any, i: number) => {
                    const cfg = txCategoryConfig[tx.category] || { label: tx.category, icon: <Receipt className="h-4 w-4" />, colorClass: "text-muted-foreground bg-muted/50" };
                    const isCredit = tx.type === "credit";
                    const isPending = tx.status === "pending";
                    const date = new Date(tx.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
                    const releaseDate = tx.release_date ? new Date(tx.release_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : null;

                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.colorClass}`}>{cfg.icon}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{cfg.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {date}
                              {isPending && releaseDate && <span className="ml-1.5 text-primary">· libera {releaseDate}</span>}
                              {tx.balance_type === "pending" && !isPending && <span className="ml-1.5 text-muted-foreground/60">· retido</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className={`text-sm font-bold ${isCredit ? "text-emerald-500" : "text-destructive"}`}>
                            {isCredit ? "+" : "-"}R$ {(tx.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          {isPending && <span className="text-[0.6rem] text-primary font-medium">pendente</span>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {hasMore && (
                  <div className="px-5 py-3 border-t border-border text-center">
                    <button onClick={() => setTxLimit((l) => l + 20)} className="text-xs text-primary hover:underline">
                      Ver mais {Math.min(20, filtered.length - txLimit)} movimentações
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        );
      })()}

      {/* Row 4: Histórico de Saques */}
      <motion.div {...anim(0.4)} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Histórico de Saques</h2>
          <span className="text-xs text-muted-foreground">{withdrawals.length} saque(s)</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : withdrawals.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum saque realizado ainda.</div>
        ) : (
          <div>
            {withdrawals.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10">
                    <ArrowDownToLine className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      R$ {(w.amount / 100).toFixed(2)}
                      <span className="text-xs text-muted-foreground ml-1.5">(taxa: R$ {(WITHDRAWAL_FEE / 100).toFixed(2)})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono text-[0.65rem] bg-muted px-1 py-0.5 rounded mr-1.5">#{w.id.substring(0, 8).toUpperCase()}</span>
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
      </motion.div>
    </div>
  );
}
