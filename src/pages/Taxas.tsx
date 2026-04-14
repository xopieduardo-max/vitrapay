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

  // Simulator math
  const valueCents = Math.round(parseFloat(simValue || "0") * 100);
  const SERVICE_FEE = 99; // R$ 0,99

  const selectedPlan = PLANS.find((p) => p.id === cardPlan) || PLANS[0];

  const pixPlatformFee = 249; // R$ 2,49
  const pixGatewayCost = 199; // R$ 1,99
  const pixPlatformProfit = pixPlatformFee - pixGatewayCost; // R$ 0,50

  const cardPctFee = Math.round(valueCents * (selectedPlan.pct / 100));
  const cardFixedFee = selectedPlan.fixed;
  const cardTotalFee = cardPctFee + cardFixedFee;

  let platformFee = 0;
  let producerReceives = 0;
  let buyerPays = 0;

  if (simMethod === "pix") {
    platformFee = pixPlatformFee;
    producerReceives = valueCents - pixPlatformFee;
    buyerPays = valueCents + SERVICE_FEE;
  } else {
    platformFee = cardTotalFee;
    producerReceives = valueCents - cardTotalFee;
    buyerPays = valueCents + SERVICE_FEE;
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

        {valueCents > 0 && (
          <div className="rounded-xl bg-muted/20 border border-border/50 p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do produto</span>
              <span className="font-medium">{fmt(valueCents)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Taxa da plataforma {simMethod === "pix" ? "(fixa)" : `(${selectedPlan.pct}% + R$ 2,49)`}
              </span>
              <span className="font-medium text-destructive">- {fmt(platformFee)}</span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex justify-between text-base">
              <span className="font-semibold">Você recebe</span>
              <span className={`font-bold ${producerReceives >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {fmt(producerReceives)}
              </span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Comprador paga (produto + taxa de serviço)</span>
              <span className="font-medium">{fmt(buyerPays)}</span>
            </div>

            {simMethod === "card" && (
              <div className="rounded-xl bg-muted/30 p-3.5 text-xs text-muted-foreground">
                <p>
                  <strong>Plano selecionado:</strong> {selectedPlan.label} — liberação em{" "}
                  {selectedPlan.id === "d2" ? "2 dias úteis" : "30 dias corridos"}.
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
