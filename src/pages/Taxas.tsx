import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, Save, CreditCard, Zap, Clock, Calculator, QrCode, Percent,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Taxas e Plano</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha seu plano de recebimento e simule suas taxas
        </p>
      </div>

      {/* Fixed fees info */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <QrCode className="h-4 w-4 text-primary" />
          Taxas por Método de Pagamento
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">PIX</p>
            <p className="text-lg font-bold">R$ 2,49 <span className="text-xs font-normal text-muted-foreground">por venda</span></p>
            <p className="text-[0.65rem] text-muted-foreground">Taxa fixa. Liberação D+0 (imediato).</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cartão de Crédito</p>
            <p className="text-lg font-bold">
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
      </div>

      {/* Plan Selection */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="h-4 w-4 text-primary" />
          Plano de Recebimento (Cartão)
        </div>
        <p className="text-xs text-muted-foreground">
          Escolha quando deseja receber os valores das vendas por cartão de crédito. 
          Vendas via PIX são sempre D+0 (imediato). Todos começam no plano Padrão (D+30).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setCardPlan(plan.id)}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                cardPlan === plan.id
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              {cardPlan === plan.id && (
                <span className="absolute top-2 right-2 text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  Ativo
                </span>
              )}
              {plan.default && cardPlan !== plan.id && (
                <span className="absolute top-2 right-2 text-[0.6rem] font-medium uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Padrão
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <plan.icon className={`h-5 w-5 ${plan.iconColor}`} />
                <span className="font-bold text-sm">{plan.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{plan.desc}</p>
              <div className="space-y-1">
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
          >
            {savingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Plano
          </Button>
        </div>
      </div>

      {/* Fee Simulator */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-primary" />
          Simulador de Taxas
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
              className="bg-muted/50 border-transparent focus:border-border"
              placeholder="100.00"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Método de pagamento</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setSimMethod("pix")}
                className={`flex-1 rounded-lg border-2 py-2 px-3 text-xs font-semibold transition-all ${
                  simMethod === "pix"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                PIX
              </button>
              <button
                onClick={() => setSimMethod("card")}
                className={`flex-1 rounded-lg border-2 py-2 px-3 text-xs font-semibold transition-all ${
                  simMethod === "card"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                Cartão
              </button>
            </div>
          </div>
        </div>

        <Separator />

        {valueCents > 0 && (
          <div className="space-y-3">
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

            <Separator />

            <div className="flex justify-between text-base">
              <span className="font-semibold">Você recebe</span>
              <span className={`font-bold ${producerReceives >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {fmt(producerReceives)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Comprador paga (produto + taxa de serviço)</span>
              <span className="font-medium">{fmt(buyerPays)}</span>
            </div>

            {simMethod === "card" && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>
                  <strong>Plano selecionado:</strong> {selectedPlan.label} — liberação em{" "}
                  {selectedPlan.id === "d2" ? "2 dias úteis" : "30 dias corridos"}.
                </p>
              </div>
            )}

            {simMethod === "pix" && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>
                  <strong>PIX:</strong> Taxa fixa de R$ 2,49. Liberação D+0 (imediato).
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
