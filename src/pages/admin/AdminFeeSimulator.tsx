import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Calculator, CreditCard, QrCode, Barcode, Save, Loader2,
  TrendingUp, TrendingDown, Building2, Landmark, User, Receipt,
  ShoppingCart, Zap, Clock, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  maxInstallmentsForPrice,
  asaasCardTierPct,
  asaasEffectivePct as calcAsaasEffectivePct,
  computeBuyerTotal,
  computeAsaasCost,
  computePlatformFee,
  computeServiceFeeNet,
  ASAAS_CARD_FIXED_CENTS,
  ASAAS_D2_ADD_PCT,
  SERVICE_FEE_CENTS as SERVICE_FEE,
  BUYER_INSTALLMENT_INTEREST_MONTHLY,
} from "@/lib/pricing";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell,
} from "recharts";

const METHODS = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "card", label: "Cartão de Crédito", icon: CreditCard },
  { id: "boleto", label: "Boleto", icon: Barcode },
] as const;

const VP_DEFAULTS: Record<string, { pct: number; fixed: number }> = {
  pix:    { pct: 0,    fixed: 399 },
  card:   { pct: 3.99, fixed: 249 },
  boleto: { pct: 0,    fixed: 399 },
};

const fmt = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

export default function AdminFeeSimulator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("100");
  const [method, setMethod] = useState<"pix" | "card" | "boleto">("card");
  const [installments, setInstallments] = useState(1);
  const [antecipacao, setAntecipacao] = useState<"D30" | "D2">("D30");

  const { data: dbFees, isLoading } = useQuery({
    queryKey: ["platform-fees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_fees").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  // VitraPay editable state (from DB or defaults)
  const [vpState, setVpState] = useState<Record<string, { pct: string; fixed: string }>>({});
  const getVp = (m: string) => ({
    pct: vpState[m]?.pct ?? String(dbFees
      ? (m === "pix" ? dbFees.pix_percentage
        : m === "card" ? dbFees.card_percentage
        : m === "card_d2" ? dbFees.card_percentage_d2
        : dbFees.boleto_percentage)
      : (m === "card_d2" ? 4.99 : VP_DEFAULTS[m].pct)),
    fixed: vpState[m]?.fixed ?? String((dbFees
      ? (m === "pix" ? dbFees.pix_fixed
        : m === "card" || m === "card_d2" ? dbFees.card_fixed
        : dbFees.boleto_fixed)
      : (m === "card_d2" ? VP_DEFAULTS.card.fixed : VP_DEFAULTS[m].fixed)) / 100),
  });
  const setVp = (m: string, field: "pct" | "fixed", v: string) =>
    setVpState((prev) => ({ ...prev, [m]: { ...getVp(m), [field]: v } }));

  const amount = Math.round((parseFloat(value) || 0) * 100);
  const isValid = amount >= 500;
  const maxInst = maxInstallmentsForPrice(amount || 0);
  const installmentsAllowed = method === "card" && installments <= maxInst;

  // Comprador paga (com juros se parcelado 2x+)
  const buyerTotal = useMemo(
    () => computeBuyerTotal(amount, method, installments),
    [amount, method, installments],
  );

  // Custo Asaas real (baseado no valor total cobrado do comprador)
  const asaasCost = useMemo(
    () => computeAsaasCost(buyerTotal, method, installments, antecipacao),
    [buyerTotal, method, installments, antecipacao],
  );

  const asaasEffectivePct = method === "card" ? calcAsaasEffectivePct(installments, antecipacao) : 0;

  // Taxa VitraPay cobrada do produtor (sobre o valor do produto).
  // Cartão D+2 usa a taxa própria (card_percentage_d2), igual à produção
  // (create-card-payment/index.ts busca platform_fees.card_percentage_d2 quando isD2).
  const vpCfg = getVp(method);
  const vpPctVal = parseFloat(vpCfg.pct) || 0;
  const vpPctEffective = method === "card" && antecipacao === "D2"
    ? parseFloat(getVp("card_d2").pct) || 0
    : vpPctVal;
  const vpFixedVal = Math.round((parseFloat(vpCfg.fixed) || 0) * 100);
  const feePlatform = computePlatformFee(amount, vpPctEffective, vpFixedVal);

  // Serviço R$0,99 pago pelo comprador (líquido, descontando gateway) — só informativo na UI.
  const serviceFeeNet = computeServiceFeeNet(method, installments, antecipacao);

  // Juro do parcelamento: cobrado do comprador, mas NUNCA repassado ao produtor
  // (ele recebe amount − feePlatform) — por isso é receita real da plataforma,
  // igual ao buyerInterest em create-card-payment/index.ts.
  const buyerInterest = Math.max(0, buyerTotal - amount - SERVICE_FEE);

  const producerReceives = amount - feePlatform;
  // asaasCost já é calculado sobre buyerTotal (produto + juro + taxa de serviço), então
  // o corte % do Asaas sobre a taxa de serviço já está embutido ali — por isso soma-se
  // SERVICE_FEE bruto aqui (não serviceFeeNet, que descontaria o corte do Asaas 2x).
  const platformProfit = feePlatform + SERVICE_FEE + buyerInterest - asaasCost;
  const profitMarginPct = amount > 0 ? (platformProfit / amount) * 100 : 0;

  // Check if values changed from DB
  const hasChanges = dbFees && (
    getVp("pix").pct !== String(dbFees.pix_percentage) ||
    getVp("pix").fixed !== String(dbFees.pix_fixed / 100) ||
    getVp("card").pct !== String(dbFees.card_percentage) ||
    getVp("card").fixed !== String(dbFees.card_fixed / 100) ||
    getVp("card_d2").pct !== String(dbFees.card_percentage_d2) ||
    getVp("boleto").pct !== String(dbFees.boleto_percentage) ||
    getVp("boleto").fixed !== String(dbFees.boleto_fixed / 100)
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const vp = { pix: getVp("pix"), card: getVp("card"), cardD2: getVp("card_d2"), boleto: getVp("boleto") };
      const { error } = await supabase.from("platform_fees").update({
        pix_percentage: parseFloat(vp.pix.pct) || 0,
        pix_fixed: Math.round((parseFloat(vp.pix.fixed) || 0) * 100),
        card_percentage: parseFloat(vp.card.pct) || 0,
        card_fixed: Math.round((parseFloat(vp.card.fixed) || 0) * 100),
        card_percentage_d2: parseFloat(vp.cardD2.pct) || 0,
        boleto_percentage: parseFloat(vp.boleto.pct) || 0,
        boleto_fixed: Math.round((parseFloat(vp.boleto.fixed) || 0) * 100),
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Taxas salvas com sucesso" });
      setVpState({});
      queryClient.invalidateQueries({ queryKey: ["platform-fees"] });
    },
    onError: (err: any) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  // Tabela comparativa: todas as parcelas 1x..maxInst (só cartão)
  const scenarioMatrix = useMemo(() => {
    if (method !== "card" || !isValid) return [];
    return Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => {
      const bTotal = computeBuyerTotal(amount, "card", n);
      const aCost = computeAsaasCost(bTotal, "card", n, antecipacao);
      const interest = Math.max(0, bTotal - amount - SERVICE_FEE);
      const pct = calcAsaasEffectivePct(n, antecipacao);
      const profit = feePlatform + SERVICE_FEE + interest - aCost;
      return { n, bTotal, aCost, profit, pct };
    });
  }, [method, isValid, maxInst, amount, feePlatform, antecipacao]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const methodInfo = METHODS.find((m) => m.id === method)!;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Simulador de Taxas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simule qualquer cenário e veja exatamente quanto vai pra Asaas, produtor e plataforma
        </p>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Valor da venda (R$)</Label>
            <Input
              type="number" step="0.01" min="5"
              value={value} onChange={(e) => setValue(e.target.value)}
              className="text-lg font-semibold"
              placeholder="100.00"
            />
            {value && !isValid && (
              <p className="text-xs text-destructive">Valor mínimo: R$ 5,00</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Forma de pagamento</Label>
            <div className="flex gap-2">
              {METHODS.map((m) => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    method === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}>
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {method === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Parcelas (máximo permitido: {maxInst}x)</Label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                  const allowed = n <= maxInst;
                  return (
                    <button
                      key={n}
                      disabled={!allowed}
                      onClick={() => setInstallments(n)}
                      className={cn(
                        "min-w-[38px] h-9 px-2 rounded-md border text-xs font-semibold transition-all",
                        !allowed && "opacity-30 cursor-not-allowed",
                        installments === n && allowed && "border-primary bg-primary/10 text-primary",
                        installments !== n && allowed && "border-border bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      {n}x
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Antecipação Asaas</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAntecipacao("D30")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    antecipacao === "D30"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Clock className="h-4 w-4" /> D+30 (sem antec.)
                </button>
                <button
                  onClick={() => setAntecipacao("D2")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    antecipacao === "D2"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Zap className="h-4 w-4" /> D+2 (antecipado)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Verdict card */}
      {isValid && amount > 0 && installmentsAllowed && (
        <div className={cn(
          "rounded-xl border-2 p-5",
          platformProfit > 0 ? "border-emerald-500/30 bg-emerald-500/5"
            : platformProfit === 0 ? "border-amber-500/30 bg-amber-500/5"
            : "border-destructive/40 bg-destructive/10"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {platformProfit > 0 ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mt-0.5" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-destructive mt-0.5 animate-pulse" />
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold">
                    {platformProfit > 0 ? "Cenário lucrativo" : platformProfit === 0 ? "Empate — sem lucro" : "Cenário com prejuízo"}
                  </p>
                  {platformProfit < 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider">
                      <AlertTriangle className="h-3 w-3" /> Prejuízo
                    </span>
                  )}
                  {platformProfit === 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">
                      Empate
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {methodInfo.label}
                  {method === "card" && ` · ${installments}x · ${antecipacao === "D2" ? "antecipado D+2" : "D+30"}`}
                  {" · "}Venda de {fmt(amount)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("text-2xl font-bold",
                platformProfit > 0 ? "text-emerald-500" : platformProfit === 0 ? "text-amber-500" : "text-destructive"
              )}>
                {platformProfit >= 0 ? "+" : ""}{fmt(platformProfit)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                margem líquida {fmtPct(profitMarginPct)}
              </p>
            </div>
          </div>

          {/* Diagnóstico de prejuízo */}
          {platformProfit < 0 && (() => {
            const asaasFixedTotal = method === "card" ? ASAAS_CARD_FIXED_CENTS * installments : asaasCost;
            const asaasPctCost = method === "card" ? Math.max(0, asaasCost - asaasFixedTotal) : 0;
            const d2Extra = method === "card" && antecipacao === "D2"
              ? Math.round(buyerTotal * (ASAAS_D2_ADD_PCT / 100)) : 0;
            const revenue = feePlatform + SERVICE_FEE + buyerInterest;
            const shortfall = asaasCost - revenue;

            const culprits: { label: string; detail: string; weight: number }[] = [];

            if (method === "card" && asaasFixedTotal > feePlatform) {
              culprits.push({
                label: `Custo fixo Asaas alto (R$ 0,49 × ${installments} parcelas)`,
                detail: `${fmt(asaasFixedTotal)} só de fixo — maior que a taxa VitraPay (${fmt(feePlatform)})`,
                weight: asaasFixedTotal,
              });
            }
            if (method === "card" && asaasPctCost > feePlatform) {
              culprits.push({
                label: `Percentual Asaas alto para ${installments}x`,
                detail: `${asaasEffectivePct.toFixed(2)}% sobre ${fmt(buyerTotal)} = ${fmt(asaasPctCost)}`,
                weight: asaasPctCost,
              });
            }
            if (d2Extra > 0) {
              culprits.push({
                label: "Antecipação D+2 encarece a operação",
                detail: `+${ASAAS_D2_ADD_PCT}% sobre ${fmt(buyerTotal)} = ${fmt(d2Extra)} extra`,
                weight: d2Extra,
              });
            }
            if (feePlatform < asaasCost) {
              culprits.push({
                label: "Taxa VitraPay insuficiente",
                detail: `${fmt(feePlatform)} cobrado não cobre ${fmt(asaasCost)} de custo Asaas`,
                weight: asaasCost - feePlatform,
              });
            }
            if (method === "card" && amount < 2000 && installments > 1) {
              culprits.push({
                label: "Produto muito barato para parcelar",
                detail: `Venda de ${fmt(amount)} em ${installments}x — custo fixo consome a margem`,
                weight: asaasFixedTotal,
              });
            }
            culprits.sort((a, b) => b.weight - a.weight);

            return (
              <div className="mt-4 pt-4 border-t border-destructive/20 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <p className="text-xs font-bold uppercase tracking-widest text-destructive">
                    O que causou o prejuízo
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-background/60 border border-border p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Receita plataforma</p>
                    <p className="text-sm font-bold text-emerald-500 mt-1">+ {fmt(revenue)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {fmt(feePlatform)} taxa + {fmt(SERVICE_FEE)} serviço
                      {buyerInterest > 0 && ` + ${fmt(buyerInterest)} juro`}
                    </p>
                  </div>
                  <div className="rounded-md bg-background/60 border border-border p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Custo Asaas</p>
                    <p className="text-sm font-bold text-destructive mt-1">- {fmt(asaasCost)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {method === "card" && `${fmt(asaasPctCost)} % + ${fmt(asaasFixedTotal)} fixo`}
                      {method !== "card" && "fixo por transação"}
                    </p>
                  </div>
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5">
                    <p className="text-[10px] uppercase text-destructive font-semibold">Déficit</p>
                    <p className="text-sm font-bold text-destructive mt-1">- {fmt(shortfall)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      falta pra empatar
                    </p>
                  </div>
                </div>

                {culprits.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Componentes que pesaram</p>
                    {culprits.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-destructive/5 border border-destructive/20">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{c.label}</p>
                          <p className="text-[11px] text-muted-foreground">{c.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p className="font-semibold text-foreground">Como resolver:</p>
                    {method === "card" && antecipacao === "D2" && (
                      <p>• Desative a antecipação D+2 para este cenário</p>
                    )}
                    {method === "card" && installments > 3 && amount < 5000 && (
                      <p>• Limite as parcelas a no máximo 3x para valores abaixo de R$ 50</p>
                    )}
                    {feePlatform < asaasCost && (
                      <p>• Aumente a taxa VitraPay para pelo menos {fmtPct((asaasCost / amount) * 100 + 1)} + fixo</p>
                    )}
                    <p>• Ou aumente o valor do produto para diluir o custo fixo</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Breakdown detalhado */}
      {isValid && amount > 0 && installmentsAllowed && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Comprador */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Comprador paga</p>
            </div>
            <p className="text-2xl font-bold">{fmt(buyerTotal)}</p>
            <div className="space-y-1 text-xs">
              <Line label="Produto" value={fmt(amount)} />
              {method === "card" && installments > 1 && (
                <Line
                  label={`Juros parcelado (${BUYER_INSTALLMENT_INTEREST_MONTHLY}% × ${installments - 1}m)`}
                  value={fmt(buyerInterest)}
                />
              )}
              <Line label="Taxa de serviço" value={fmt(SERVICE_FEE)} />
              {method === "card" && installments > 1 && (
                <p className="pt-1 text-muted-foreground">
                  {installments}× de {fmt(Math.round((buyerTotal - SERVICE_FEE) / installments))}
                </p>
              )}
            </div>
          </div>

          {/* Produtor */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-widest font-semibold text-primary">Produtor recebe</p>
            </div>
            <p className="text-2xl font-bold text-primary">{fmt(producerReceives)}</p>
            <div className="space-y-1 text-xs">
              <Line label="Valor bruto" value={fmt(amount)} />
              <Line
                label={`Taxa VitraPay (${vpPctEffective}% + ${fmt(vpFixedVal)})`}
                value={`- ${fmt(feePlatform)}`}
                negative
              />
            </div>
          </div>

          {/* Plataforma */}
          <div className={cn(
            "rounded-xl border p-4 space-y-3",
            platformProfit >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"
          )}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-foreground" />
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Plataforma lucra</p>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              platformProfit > 0 ? "text-emerald-500" : platformProfit === 0 ? "text-amber-500" : "text-destructive"
            )}>
              {platformProfit >= 0 ? "+" : ""}{fmt(platformProfit)}
            </p>
            <div className="space-y-1 text-xs">
              <Line label="Taxa cobrada do produtor" value={`+ ${fmt(feePlatform)}`} />
              <Line label="Taxa de serviço" value={`+ ${fmt(SERVICE_FEE)}`} />
              {buyerInterest > 0 && (
                <Line label="Juro do parcelamento (retido)" value={`+ ${fmt(buyerInterest)}`} />
              )}
              <Line
                label={method === "card"
                  ? `Custo Asaas (${asaasEffectivePct.toFixed(2)}% + ${fmt(ASAAS_CARD_FIXED_CENTS)}×${installments})`
                  : `Custo Asaas (fixo)`}
                value={`- ${fmt(asaasCost)}`}
                negative
              />
            </div>
          </div>
        </div>
      )}

      {method === "card" && isValid && installments > maxInst && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-xs font-medium text-destructive">
            Parcelamento {installments}x não permitido para este valor. Máximo: {maxInst}x.
          </p>
        </div>
      )}

      {/* Gráfico: Lucro por parcela */}
      {method === "card" && isValid && scenarioMatrix.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Lucro da plataforma por parcela · {antecipacao === "D2" ? "D+2" : "D+30"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Barras verdes = lucro · vermelhas = prejuízo. Barra destacada = parcela selecionada.
            </p>
          </div>
          <div className="p-4" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scenarioMatrix.map(r => ({ ...r, profitReais: r.profit / 100 }))}
                margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <XAxis
                  dataKey="n"
                  tickFormatter={(v) => `${v}x`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `R$ ${v.toFixed(2)}`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  width={70}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => `${v}x parcelado`}
                  formatter={(val: number) => [fmt(Math.round(val * 100)), "Lucro plataforma"]}
                />
                <Bar dataKey="profitReais" radius={[6, 6, 0, 0]}>
                  {scenarioMatrix.map((row) => {
                    const isSelected = row.n === installments;
                    const color = row.profit > 0
                      ? "hsl(142 71% 45%)"
                      : row.profit === 0 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)";
                    return (
                      <Cell
                        key={row.n}
                        fill={color}
                        fillOpacity={isSelected ? 1 : 0.55}
                        stroke={isSelected ? "hsl(var(--primary))" : "transparent"}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Matriz de cenários (todas as parcelas de uma vez) */}
      {method === "card" && isValid && scenarioMatrix.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Todos os cenários — venda de {fmt(amount)} · {antecipacao === "D2" ? "D+2 antecipado" : "D+30"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare o lucro/prejuízo da plataforma em cada opção de parcelamento
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2 font-medium">Parcelas</th>
                  <th className="text-right px-4 py-2 font-medium">% Asaas</th>
                  <th className="text-right px-4 py-2 font-medium">Comprador paga</th>
                  <th className="text-right px-4 py-2 font-medium">Custo Asaas</th>
                  <th className="text-right px-4 py-2 font-medium">Lucro plataforma</th>
                  <th className="text-right px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {scenarioMatrix.map((row) => (
                  <tr
                    key={row.n}
                    className={cn(
                      "border-b border-border/50 last:border-0 transition-colors",
                      row.n === installments && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-2 font-semibold">{row.n}x</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{fmtPct(row.pct)}</td>
                    <td className="px-4 py-2 text-right">{fmt(row.bTotal)}</td>
                    <td className="px-4 py-2 text-right text-destructive">{fmt(row.aCost)}</td>
                    <td className={cn(
                      "px-4 py-2 text-right font-bold",
                      row.profit > 0 ? "text-emerald-500" : row.profit === 0 ? "text-amber-500" : "text-destructive"
                    )}>
                      {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.profit > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" /> LUCRO
                        </span>
                      ) : row.profit === 0 ? (
                        <span className="text-[10px] font-semibold text-amber-500">EMPATE</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                          <TrendingDown className="h-3 w-3" /> PREJUÍZO
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground space-y-0.5">
            <p>• Asaas cobra R$ 0,49 fixo <b>por parcela</b> — quanto mais parcelas, maior o custo fixo total.</p>
            <p>• Faixas Asaas: 1x = 2,99% · 2-6x = 3,49% · 7-12x = 3,99% (+ 1,15% se antecipado D+2).</p>
            <p>• Comprador paga {BUYER_INSTALLMENT_INTEREST_MONTHLY}% a.m. de juros a partir de 2x — não é repassado ao produtor, fica retido como receita da plataforma.</p>
            <p>• Antecipação D+2 soma +1pp na taxa VitraPay do cartão (ex: 3,99% → 4,99%) pra compensar o custo extra do Asaas.</p>
          </div>
        </div>
      )}

      {/* Referência de custos Asaas (read-only) */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Custos Asaas reais (referência)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplicados automaticamente pela plataforma conforme a faixa de parcelas.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <ReferenceRow label="PIX (D+0)" value="R$ 1,99 fixo" />
          <ReferenceRow label="Boleto" value="R$ 1,99 fixo" />
          <ReferenceRow label="Cartão 1x" value="2,99% + R$ 0,49" />
          <ReferenceRow label="Cartão 2x–6x" value="3,49% + R$ 0,49 por parcela" />
          <ReferenceRow label="Cartão 7x–12x" value="3,99% + R$ 0,49 por parcela" />
          <ReferenceRow label="Antecipação D+2" value="+ 1,15% sobre o percentual da faixa" />
        </div>
      </div>

      {/* Editable VitraPay fees */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Taxas VitraPay (cobradas do produtor)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Taxa única que o produtor paga. Já inclui o custo do gateway internamente.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasChanges}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar taxas
          </Button>
        </div>
        {METHODS.map((m) => {
          const cfg = getVp(m.id);
          return (
            <div key={m.id}>
              <FeeMethodRow icon={m.icon} label={m.label}
                pct={cfg.pct} fixed={cfg.fixed}
                onPctChange={(v) => setVp(m.id, "pct", v)}
                onFixedChange={(v) => setVp(m.id, "fixed", v)}
              />
              {m.id === "card" && (
                <div className="flex items-center gap-4 p-3 mt-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Cartão D+2</span>
                  </div>
                  <div className="flex-1 max-w-[9.5rem] space-y-1">
                    <Label className="text-[0.65rem] text-muted-foreground">% sobre venda (antecipado)</Label>
                    <Input type="number" step="0.01" min="0" value={getVp("card_d2").pct}
                      onChange={(e) => setVp("card_d2", "pct", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Usa o mesmo fixo do cartão D+30 ({fmt(Math.round((parseFloat(getVp("card").fixed) || 0) * 100))})
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Line({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={cn("font-medium tabular-nums", negative && "text-destructive")}>{value}</span>
    </div>
  );
}

function ReferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function FeeMethodRow({ icon: Icon, label, pct, fixed, onPctChange, onFixedChange }: {
  icon: any; label: string; pct: string; fixed: string;
  onPctChange: (v: string) => void; onFixedChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 min-w-[120px]">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex gap-3 flex-1 max-w-xs">
        <div className="space-y-1 flex-1">
          <Label className="text-[0.65rem] text-muted-foreground">% sobre venda</Label>
          <Input type="number" step="0.01" min="0" value={pct} onChange={(e) => onPctChange(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1 flex-1">
          <Label className="text-[0.65rem] text-muted-foreground">Fixo (R$)</Label>
          <Input type="number" step="0.01" min="0" value={fixed} onChange={(e) => onFixedChange(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
    </div>
  );
}
