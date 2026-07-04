import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Loader2, Save, CreditCard, Zap, Clock, Calculator, QrCode, Percent,
  ChevronRight,
} from "lucide-react";

const PLANS = [
  {
    id: "d30",
    label: "D+30 — Padrão",
    desc: "Receba em 30 dias corridos após a venda. Menor taxa.",
    icon: Clock,
    pct: 3.99,
    fixed: 249,
    iconColor: "text-muted-foreground",
    default: true,
  },
  {
    id: "d2",
    label: "D+2 — Antecipação",
    desc: "Receba em 2 dias úteis após a venda. Mais rápido.",
    icon: Zap,
    pct: 4.99,
    fixed: 249,
    iconColor: "text-primary",
    default: false,
  },
];

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.45, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

export default function Taxas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cardPlan, setCardPlan] = useState("d30");
  const [savingPlan, setSavingPlan] = useState(false);

  // Simulator
  const [simValue, setSimValue] = useState("100");
  const [simMethod, setSimMethod] = useState<"pix" | "card">("pix");
  const [simInstallments, setSimInstallments] = useState<number>(1);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-taxas", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("card_plan")
        .eq("user_id", user.id)
        .single();
      if (data) setCardPlan(data.card_plan || "d30");
      return data;
    },
    enabled: !!user,
  });

  const handleSavePlan = async () => {
    if (!user) return;
    setSavingPlan(true);
    const { error } = await supabase
      .from("profiles")
      .update({ card_plan: cardPlan } as any)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao salvar plano.");
    } else {
      toast.success("Plano de recebimento atualizado!");
      queryClient.invalidateQueries({ queryKey: ["profile-taxas", user.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    setSavingPlan(false);
  };

  // ── Simulator math (mirrors create-card-payment + Checkout) ──
  const productAmount = Math.round(parseFloat(simValue || "0") * 100);
  const SERVICE_FEE = 99;            // R$ 0,99 cobrado do comprador em toda venda
  const MONTHLY_INTEREST = 0.016;    // mesmo do Checkout
  const PIX_PLATFORM_FEE = 249;      // R$ 2,49
  const PIX_GATEWAY_COST = 199;      // R$ 1,99

  const selectedPlan = PLANS.find((p) => p.id === cardPlan) || PLANS[0];
  const isD2 = selectedPlan.id === "d2";

  // Cartão (alinhado a create-card-payment)
  // Limite de parcelas por faixa de preço (sincronizado com backend)
  const maxInstallmentsAllowed = (() => {
    if (productAmount < 2000) return 3;
    if (productAmount < 5000) return 6;
    if (productAmount < 10000) return 10;
    return 12;
  })();
  const n = Math.max(1, Math.min(maxInstallmentsAllowed, simInstallments));
  const tier = n === 1 ? "x1" : n <= 6 ? "x6" : "x12";
  const ASAAS_BASE_PCT = tier === "x1" ? 0.0299 : tier === "x6" ? 0.0349 : 0.0399;
  // D+2 soma +1,15% a.m. de antecipação em cima da faixa base
  const ASAAS_PCT = isD2 ? ASAAS_BASE_PCT + 0.0115 : ASAAS_BASE_PCT;
  const ASAAS_FIXED_PER_INSTALLMENT = 49;

  // Juros do parcelamento embutidos no valor cobrado do comprador (apenas n > 1)
  const buyerInterest =
    n > 1 ? Math.round(productAmount * MONTHLY_INTEREST * (n - 1)) : 0;

  // Total efetivamente cobrado pelo Asaas (produto + serviço + juros)
  const cardChargedAmount = productAmount + SERVICE_FEE + buyerInterest;
  const installmentValue = n > 0 ? cardChargedAmount / n : 0;

  // Taxa da plataforma incide SOMENTE sobre o valor do produto
  const platformPctFee = Math.round(productAmount * (selectedPlan.pct / 100));
  const platformFixedFee = selectedPlan.fixed;
  const platformFee = platformPctFee + platformFixedFee;

  // Custo do Asaas (sobre o valor cobrado total, fixo por parcela)
  const asaasCost =
    Math.round(cardChargedAmount * ASAAS_PCT) + ASAAS_FIXED_PER_INSTALLMENT * n;

  // Quem recebe o quê
  let producerReceives = 0;
  let buyerPays = 0;
  let platformGross = 0; // receita bruta da plataforma (antes do custo do gateway)
  let platformNet = 0;   // o que vai para "Disponível p/ saque" da plataforma

  if (simMethod === "pix") {
    producerReceives = productAmount - PIX_PLATFORM_FEE;
    buyerPays = productAmount + SERVICE_FEE;
    platformGross = PIX_PLATFORM_FEE + SERVICE_FEE;
    platformNet = platformGross - PIX_GATEWAY_COST;
  } else {
    producerReceives = productAmount - platformFee;
    buyerPays = cardChargedAmount;
    platformGross = platformFee + SERVICE_FEE + buyerInterest;
    platformNet = platformGross - asaasCost;
  }

  const fmt = (v: number) =>
    `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div {...anim(0)} className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold tracking-tight">Taxas e Plano</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha seu plano de recebimento e simule suas taxas
        </p>
      </motion.div>

      {/* Breadcrumb */}
      <motion.div {...anim(0.04)} className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <span className="hover:text-foreground transition-colors cursor-pointer">Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Taxas e Plano</span>
      </motion.div>

      {/* Fixed fees info */}
      <motion.div {...anim(0.08)} className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <QrCode className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-bold">Taxas por Método de Pagamento</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">PIX</p>
            <p className="text-xl font-bold">R$ 2,49 <span className="text-xs font-normal text-muted-foreground">por venda</span></p>
            <p className="text-[0.65rem] text-muted-foreground">Taxa fixa. Liberação D+0 (imediato).</p>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Cartão de Crédito</p>
            <p className="text-xl font-bold">
              {selectedPlan.pct}% + R$ 2,49
            </p>
            <p className="text-[0.65rem] text-muted-foreground">
              Plano {selectedPlan.id === "d2" ? "D+2 (Antecipação)" : "D+30 (Padrão)"}
            </p>
          </div>
        </div>
        <p className="text-[0.65rem] text-muted-foreground">
          + R$ 0,99 de taxa de serviço cobrada do comprador em todas as transações.
        </p>
      </motion.div>

      {/* Plan Selection */}
      <motion.div {...anim(0.12)} className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-bold">Plano de Recebimento (Cartão)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Escolha quando deseja receber os valores das vendas por cartão de crédito.
          Vendas via PIX são sempre D+0 (imediato). Todos começam no plano Padrão (D+30).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setCardPlan(plan.id)}
              className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-300 ${
                cardPlan === plan.id
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
              }`}
            >
              {cardPlan === plan.id && (
                <span className="absolute top-3 right-3 text-[0.6rem] font-bold uppercase px-2 py-0.5 rounded-md bg-primary text-primary-foreground shadow-sm">
                  Ativo
                </span>
              )}
              {plan.default && cardPlan !== plan.id && (
                <span className="absolute top-3 right-3 text-[0.6rem] font-medium uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  Padrão
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  cardPlan === plan.id ? "bg-primary/15" : "bg-muted/50"
                }`}>
                  <plan.icon className={`h-5 w-5 ${cardPlan === plan.id ? "text-primary" : plan.iconColor}`} />
                </div>
                <span className="font-bold text-sm">{plan.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{plan.desc}</p>
              <div className="space-y-2 pt-3 border-t border-border/50">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Taxa percentual</span>
                  <span className="font-semibold">{plan.pct.toFixed(2).replace(".", ",")}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Taxa fixa</span>
                  <span className="font-semibold">R$ 2,49</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={savingPlan || cardPlan === (profile?.card_plan || "d30")}
            onClick={handleSavePlan}
            className="rounded-xl"
          >
            {savingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Plano
          </Button>
        </div>
      </motion.div>

      {/* Fee Simulator */}
      <motion.div {...anim(0.16)} className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-bold">Simulador de Taxas</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Simule quanto você vai receber em cada venda de acordo com o método de pagamento e seu plano atual.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Valor do produto (R$)</Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              value={simValue}
              onChange={(e) => setSimValue(e.target.value)}
              className="bg-muted/30 border-border/50 focus:border-primary rounded-xl h-11"
              placeholder="100.00"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Método de pagamento</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setSimMethod("pix")}
                className={`flex-1 rounded-xl border-2 py-2.5 px-3 text-xs font-semibold transition-all duration-300 ${
                  simMethod === "pix"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                PIX
              </button>
              <button
                onClick={() => setSimMethod("card")}
                className={`flex-1 rounded-xl border-2 py-2.5 px-3 text-xs font-semibold transition-all duration-300 ${
                  simMethod === "card"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                Cartão
              </button>
            </div>
          </div>
        </div>

        {simMethod === "card" && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Parcelamento
            </Label>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((opt) => {
                const disabled = opt > maxInstallmentsAllowed;
                return (
                  <button
                    key={opt}
                    disabled={disabled}
                    onClick={() => !disabled && setSimInstallments(opt)}
                    title={disabled ? `Produto ≥ R$ ${opt === 4 || opt === 5 || opt === 6 ? "20" : opt <= 10 ? "50" : "100"} para ${opt}x` : undefined}
                    className={`rounded-lg border py-1.5 text-[0.7rem] font-semibold transition-all ${
                      disabled
                        ? "border-border/40 text-muted-foreground/40 cursor-not-allowed line-through"
                        : simInstallments === opt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {opt}x
                  </button>
                );
              })}
            </div>
            <p className="text-[0.65rem] text-muted-foreground">
              Este produto pode ser parcelado em até <strong>{maxInstallmentsAllowed}x</strong>. Limite ajustado conforme o valor para manter margem saudável em todas as vendas.
            </p>
          </div>
        )}


        {productAmount > 0 && (
          <div className="rounded-xl bg-muted/20 border border-border/50 p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do produto</span>
              <span className="font-medium">{fmt(productAmount)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Taxa da plataforma{" "}
                {simMethod === "pix"
                  ? "(fixa)"
                  : `(${selectedPlan.pct}% + R$ 2,49 sobre o produto)`}
              </span>
              <span className="font-medium text-destructive">
                - {fmt(simMethod === "pix" ? PIX_PLATFORM_FEE : platformFee)}
              </span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex justify-between text-base">
              <span className="font-semibold">Você recebe (produtor)</span>
              <span
                className={`font-bold ${
                  producerReceives >= 0 ? "text-emerald-500" : "text-destructive"
                }`}
              >
                {fmt(producerReceives)}
              </span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Comprador paga{" "}
                {simMethod === "card" && n > 1
                  ? `(${n}x de ${fmt(Math.round(installmentValue))})`
                  : "(produto + taxa de serviço)"}
              </span>
              <span className="font-medium">{fmt(buyerPays)}</span>
            </div>

            {simMethod === "card" && n > 1 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  └ Juros de parcelamento ({(MONTHLY_INTEREST * 100).toFixed(1)}% a.m. × {n - 1})
                </span>
                <span className="font-medium text-pink-500">+ {fmt(buyerInterest)}</span>
              </div>
            )}


            {simMethod === "card" && (
              <div className="rounded-xl bg-muted/30 p-3.5 text-xs text-muted-foreground">
                <p>
                  <strong>Plano selecionado:</strong> {selectedPlan.label} — liberação em{" "}
                  {isD2 ? "2 dias úteis" : "30 dias corridos"}. O produtor recebe sempre
                  sobre o valor do produto — os juros do parcelamento são receita da plataforma.
                </p>
              </div>
            )}

            {simMethod === "pix" && (
              <div className="rounded-xl bg-muted/30 p-3.5 text-xs text-muted-foreground">
                <p>
                  <strong>PIX:</strong> Taxa fixa de R$ 2,49. Liberação D+0 (imediato).
                </p>
              </div>
            )}
          </div>
        )}

      </motion.div>
    </div>
  );
}
