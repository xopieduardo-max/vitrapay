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
  QrCode, Copy, Check, Receipt, RotateCcw, Percent, Star,
} from "lucide-react";

// ── Platform constants ──
const MIN_WITHDRAWAL = 1000;    // R$ 10.00 in cents
const WITHDRAWAL_FEE = 500;     // R$ 5.00 in cents
const AUTO_APPROVE_LIMIT = 10000; // R$ 100.00 — auto PIX

export default function Finance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [detailView, setDetailView] = useState<"available" | "held" | null>(null);
  const [amount, setAmount] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [txLimit, setTxLimit] = useState(20);

  // ── Gerar Pix Avulso ──
  const [pixOpen, setPixOpen] = useState(false);
  const [pixAmount, setPixAmount] = useState("");
  const [pixDesc, setPixDesc] = useState("");
  const [pixResult, setPixResult] = useState<{ qrCode: string; copyPaste: string; value: number; dueDate: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixGenerating, setPixGenerating] = useState(false);

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

  // Get transactions (extrato)
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("id, type, category, amount, balance_type, status, release_date, created_at, reference_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!user,
  });

  // ── Balance calculations (use wallet as source of truth) ──
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((acc, w) => acc + Number(w.amount), 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((acc, w) => acc + Number(w.amount) + WITHDRAWAL_FEE, 0);

  const walletAvailableBalance = Number(wallet?.balance_available ?? 0);
  const availableBalance = Math.max(0, walletAvailableBalance - pendingWithdrawals);
  const totalHeld = Number(wallet?.balance_pending ?? 0);
  const totalEarnings = Number(wallet?.balance_total ?? 0) + totalWithdrawn;

  const cardPlan = profile?.card_plan || "d30";
  const HOLDBACK_DAYS_CARD_LABEL = cardPlan === "d2" ? 2 : 30;

  // ── Withdrawal amount entered by the user = total debited from wallet ──
  const parsedAmount = Math.round(parseFloat((amount || "0").replace(",", ".")) * 100);
  const netAfterFee = parsedAmount > 0 ? Math.max(0, parsedAmount - WITHDRAWAL_FEE) : 0;

  // ── Withdrawal mutation (uses edge function) ──
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
        body: {
          amount: netAfterFee,
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
        },
      });
      if (error) {
        // Extract the actual error message from the edge function response
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
        body: {
          amount: parsedPixAmount,
          description: pixDesc.trim() || undefined,
        },
      });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error || error.message || "Erro ao gerar Pix");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.pix_copy_paste) throw new Error("QR Code não retornado pelo gateway");
      setPixResult({
        qrCode: data.pix_qr_code || "",
        copyPaste: data.pix_copy_paste,
        value: data.value,
        dueDate: data.due_date,
      });
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
    if (!open) {
      setPixAmount("");
      setPixDesc("");
      setPixResult(null);
      setPixCopied(false);
    }
  }

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
        <div className="flex items-center gap-2">
          {/* ── Gerar Pix Avulso ── */}
          <Dialog open={pixOpen} onOpenChange={handlePixDialogClose}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <QrCode className="h-4 w-4" strokeWidth={1.5} />
                Gerar Pix
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Gerar Pix Avulso</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Gere um QR Code Pix para enviar diretamente ao seu cliente.
                </p>
              </DialogHeader>

              {!pixResult ? (
                <div className="space-y-5 pt-1">
                  {/* Fee breakdown */}
                  <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Valor informado</span>
                      <span className="text-xs font-medium">
                        R$ {pixAmount ? parseFloat((pixAmount || "0").replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
                      </span>
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
                      <span className="text-xs font-bold text-primary">
                        R$ {pixAmount ? Math.max(0, parseFloat((pixAmount || "0").replace(",", ".")) - 2.49).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Valor <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                      <span className="px-3 text-sm text-muted-foreground font-medium bg-muted/50 h-10 flex items-center border-r border-input">
                        R$
                      </span>
                      <Input
                        placeholder="50,00"
                        value={pixAmount}
                        onChange={(e) => setPixAmount(e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Descrição <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
                    </Label>
                    <Input
                      placeholder="Ex: Consultoria, Produto X..."
                      value={pixDesc}
                      onChange={(e) => setPixDesc(e.target.value)}
                      maxLength={72}
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" className="flex-1" onClick={() => setPixOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      disabled={!pixAmount || pixGenerating}
                      onClick={handleGeneratePix}
                    >
                      {pixGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <QrCode className="h-4 w-4" />
                          Gerar Pix
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 pt-1">
                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-2xl border border-border p-4 bg-white">
                      {pixResult.qrCode ? (
                        <img
                          src={`data:image/png;base64,${pixResult.qrCode}`}
                          alt="QR Code Pix"
                          className="w-52 h-52 rounded-lg"
                        />
                      ) : (
                        <div className="w-52 h-52 flex items-center justify-center text-muted-foreground text-xs">
                          QR Code indisponível
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">
                        R$ {pixResult.value?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      {pixResult.dueDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Válido até {new Date(pixResult.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      {pixDesc && (
                        <p className="text-xs text-muted-foreground mt-0.5">{pixDesc}</p>
                      )}
                    </div>
                  </div>

                  {/* Copia e cola */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Código Pix (copia e cola)</Label>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground break-all leading-relaxed max-h-20 overflow-y-auto">
                      {pixResult.copyPaste}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => setPixResult(null)}
                    >
                      Gerar Novo
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      onClick={handleCopyPix}
                    >
                      {pixCopied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar Código
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

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
                  <span className="text-sm text-muted-foreground">Disponível para novo saque</span>
                  <span className="text-sm font-bold">
                    R$ {(availableBalance / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {pendingWithdrawals > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Você já possui <strong>R$ {(pendingWithdrawals / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> reservados em saque pendente. Aguarde a conclusão para liberar esse saldo novamente.
                    </p>
                  </div>
                )}

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
                    disabled={parsedAmount < MIN_WITHDRAWAL || parsedAmount > availableBalance || !pixKey || profileIncomplete}
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
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Saldo Disponível", value: availableBalance, icon: Wallet, color: "text-emerald-500", cardClass: "border-emerald-500/30 bg-emerald-500/5", description: pendingWithdrawals > 0 ? "Já desconta saques pendentes" : "Pronto para saque", clickAction: "available" as const },
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

      {/* Balance breakdown card — always visible */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" /> Composição do saldo
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Saldo na carteira</span>
            </div>
            <span className="font-semibold">R$ {(walletAvailableBalance / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-warning" />
              <span className="text-muted-foreground">Reservado em saques pendentes</span>
            </div>
            <span className={`font-semibold ${pendingWithdrawals > 0 ? "text-warning" : ""}`}>
              {pendingWithdrawals > 0 ? "- " : ""}R$ {(pendingWithdrawals / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold">Disponível para novo saque</span>
            </div>
            <span className="text-lg font-bold text-emerald-500">
              R$ {(availableBalance / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </motion.div>

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

      {/* Extrato de Movimentações */}
      {(() => {
        const txCategoryConfig: Record<string, { label: string; icon: React.ReactNode; colorClass: string }> = {
          sale:                    { label: "Venda",               icon: <TrendingUp className="h-4 w-4" />,    colorClass: "text-emerald-500 bg-emerald-500/10" },
          commission:              { label: "Comissão",            icon: <Star className="h-4 w-4" />,          colorClass: "text-emerald-500 bg-emerald-500/10" },
          fee:                     { label: "Taxa plataforma",     icon: <Percent className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
          withdrawal:              { label: "Saque",               icon: <ArrowDownToLine className="h-4 w-4" />, colorClass: "text-blue-500 bg-blue-500/10" },
          refund:                  { label: "Estorno",             icon: <RotateCcw className="h-4 w-4" />,     colorClass: "text-orange-500 bg-orange-500/10" },
          chargeback:              { label: "Chargeback",          icon: <AlertCircle className="h-4 w-4" />,   colorClass: "text-destructive bg-destructive/10" },
          med:                     { label: "MED Pix",             icon: <AlertCircle className="h-4 w-4" />,   colorClass: "text-destructive bg-destructive/10" },
          service_fee:             { label: "Taxa de serviço",     icon: <Percent className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
          "admin-withdrawal":      { label: "Ajuste admin",        icon: <Receipt className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
          "admin-service-fee-withdrawal": { label: "Ajuste admin", icon: <Receipt className="h-4 w-4" />,       colorClass: "text-muted-foreground bg-muted/50" },
        };

        const filtered = transactions.filter((tx) =>
          txFilter === "all" ? true : tx.type === txFilter
        );
        const visible = filtered.slice(0, txLimit);
        const hasMore = filtered.length > txLimit;

        return (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">Extrato de Movimentações</h2>
              <div className="flex items-center gap-1">
                {(["all", "credit", "debit"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setTxFilter(f); setTxLimit(20); }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      txFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {f === "all" ? "Todos" : f === "credit" ? "Entradas" : "Saídas"}
                  </button>
                ))}
              </div>
            </div>

            {txLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma movimentação encontrada.
              </div>
            ) : (
              <>
                <div>
                  {visible.map((tx: any, i: number) => {
                    const cfg = txCategoryConfig[tx.category] || {
                      label: tx.category,
                      icon: <Receipt className="h-4 w-4" />,
                      colorClass: "text-muted-foreground bg-muted/50",
                    };
                    const isCredit = tx.type === "credit";
                    const isPending = tx.status === "pending";
                    const date = new Date(tx.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
                    const releaseDate = tx.release_date
                      ? new Date(tx.release_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                      : null;

                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.colorClass}`}>
                            {cfg.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{cfg.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {date}
                              {isPending && releaseDate && (
                                <span className="ml-1.5 text-warning">· libera {releaseDate}</span>
                              )}
                              {tx.balance_type === "pending" && !isPending && (
                                <span className="ml-1.5 text-muted-foreground/60">· retido</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className={`text-sm font-bold ${isCredit ? "text-emerald-500" : "text-destructive"}`}>
                            {isCredit ? "+" : "-"}R$ {(tx.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          {isPending && (
                            <span className="text-[0.6rem] text-warning font-medium">pendente</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {hasMore && (
                  <div className="px-4 py-3 border-t border-border text-center">
                    <button
                      onClick={() => setTxLimit((l) => l + 20)}
                      className="text-xs text-primary hover:underline"
                    >
                      Ver mais {Math.min(20, filtered.length - txLimit)} movimentações
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

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
                      <span className="font-mono text-[0.65rem] bg-muted px-1 py-0.5 rounded mr-1.5">
                        #{w.id.substring(0, 8).toUpperCase()}
                      </span>
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
