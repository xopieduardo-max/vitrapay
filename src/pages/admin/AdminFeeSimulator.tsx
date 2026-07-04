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
import { maxInstallmentsForPrice } from "@/lib/installmentLimits";

const METHODS = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "card", label: "Cartão de Crédito", icon: CreditCard },
  { id: "boleto", label: "Boleto", icon: Barcode },
] as const;

// ============ TAXAS ASAAS REAIS (por parcela) ============
// D+30: 1x 2,99% | 2-6x 3,49% | 7-12x 3,99%  (+ R$ 0,49 fixo POR parcela)
// D+2 antecipação: adiciona 1,15% a.m. sobre o valor antecipado, aproximado
// como acréscimo linear sobre o percentual da faixa da parcela.
function asaasCardTierPct(installments: number): number {
  if (installments <= 1) return 2.99;
  if (installments <= 6) return 3.49;
  return 3.99; // 7-12
}
const ASAAS_CARD_FIXED_CENTS = 49;
const ASAAS_D2_ADD_PCT = 1.15;

// PIX / Boleto continuam sendo fixo simples
const ASAAS_PIX_FIXED = 199;
const ASAAS_BOLETO_FIXED = 199;

const VP_DEFAULTS: Record<string, { pct: number; fixed: number }> = {
  pix:    { pct: 0,    fixed: 399 },
  card:   { pct: 3.99, fixed: 249 },
  boleto: { pct: 0,    fixed: 399 },
};

// Juros repassado ao comprador em parcelamento (a.m.)
const BUYER_INSTALLMENT_INTEREST_MONTHLY = 1.6;
const SERVICE_FEE = 99; // R$ 0,99 pago pelo comprador

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
    pct: vpState[m]?.pct ?? String(dbFees ? (m === "pix" ? dbFees.pix_percentage : m === "card" ? dbFees.card_percentage : dbFees.boleto_percentage) : VP_DEFAULTS[m].pct),
    fixed: vpState[m]?.fixed ?? String(dbFees ? (m === "pix" ? dbFees.pix_fixed : m === "card" ? dbFees.card_fixed : dbFees.boleto_fixed) / 100 : VP_DEFAULTS[m].fixed / 100),
  });
  const setVp = (m: string, field: "pct" | "fixed", v: string) =>
    setVpState((prev) => ({ ...prev, [m]: { ...getVp(m), [field]: v } }));

  const amount = Math.round((parseFloat(value) || 0) * 100);
  const isValid = amount >= 500;
  const maxInst = maxInstallmentsForPrice(amount || 0);
  const installmentsAllowed = method === "card" && installments <= maxInst;

  // Comprador paga (com juros se parcelado 2x+)
  const buyerTotal = useMemo(() => {
    if (method !== "card" || installments <= 1) return amount + SERVICE_FEE;
    const interestFactor = 1 + (BUYER_INSTALLMENT_INTEREST_MONTHLY / 100) * (installments - 1);
    return Math.round(amount * interestFactor) + SERVICE_FEE;
  }, [amount, method, installments]);

  // Custo Asaas real (baseado no valor total cobrado do comprador)
  const asaasCost = useMemo(() => {
    if (method === "pix") return ASAAS_PIX_FIXED;
    if (method === "boleto") return ASAAS_BOLETO_FIXED;
    // Cartão: (pct_faixa + antecipação D+2) × valor cobrado + fixo × n_parcelas
    let pct = asaasCardTierPct(installments);
    if (antecipacao === "D2") pct += ASAAS_D2_ADD_PCT;
    return Math.round(buyerTotal * (pct / 100)) + ASAAS_CARD_FIXED_CENTS * installments;
  }, [method, installments, antecipacao, buyerTotal]);

  const asaasEffectivePct = method === "card"
    ? asaasCardTierPct(installments) + (antecipacao === "D2" ? ASAAS_D2_ADD_PCT : 0)
    : 0;

  // Taxa VitraPay cobrada do produtor (sobre o valor do produto)
  const vpCfg = getVp(method);
  const vpPctVal = parseFloat(vpCfg.pct) || 0;
  const vpFixedVal = Math.round((parseFloat(vpCfg.fixed) || 0) * 100);
  const feePlatform = Math.round(amount * (vpPctVal / 100)) + vpFixedVal;

  // Serviço R$0,99 pago pelo comprador (líquido, descontando gateway)
  const serviceFeeNet = method === "card"
    ? SERVICE_FEE - Math.round(SERVICE_FEE * (asaasEffectivePct / 100))
    : SERVICE_FEE;

  const producerReceives = amount - feePlatform;
  // Lucro plataforma = (taxa cobrada + serviço líquido) − custo Asaas
  const platformProfit = feePlatform + serviceFeeNet - asaasCost;
  const profitMarginPct = amount > 0 ? (platformProfit / amount) * 100 : 0;

  // Check if values changed from DB
  const hasChanges = dbFees && (
    getVp("pix").pct !== String(dbFees.pix_percentage) ||
    getVp("pix").fixed !== String(dbFees.pix_fixed / 100) ||
    getVp("card").pct !== String(dbFees.card_percentage) ||
    getVp("card").fixed !== String(dbFees.card_fixed / 100) ||
    getVp("boleto").pct !== String(dbFees.boleto_percentage) ||
    getVp("boleto").fixed !== String(dbFees.boleto_fixed / 100)
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const vp = { pix: getVp("pix"), card: getVp("card"), boleto: getVp("boleto") };
      const { error } = await supabase.from("platform_fees").update({
        pix_percentage: parseFloat(vp.pix.pct) || 0,
        pix_fixed: Math.round((parseFloat(vp.pix.fixed) || 0) * 100),
        card_percentage: parseFloat(vp.card.pct) || 0,
        card_fixed: Math.round((parseFloat(vp.card.fixed) || 0) * 100),
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
      const factor = n <= 1 ? 1 : 1 + (BUYER_INSTALLMENT_INTEREST_MONTHLY / 100) * (n - 1);
      const bTotal = Math.round(amount * factor) + SERVICE_FEE;
      let pct = asaasCardTierPct(n) + (antecipacao === "D2" ? ASAAS_D2_ADD_PCT : 0);
      const aCost = Math.round(bTotal * (pct / 100)) + ASAAS_CARD_FIXED_CENTS * n;
      const svcNet = SERVICE_FEE - Math.round(SERVICE_FEE * (pct / 100));
      const profit = feePlatform + svcNet - aCost;
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
                <AlertTriangle className="h-6 w-6 text-destructive mt-0.5" />
              )}
              <div>
                <p className="text-sm font-bold">
                  {platformProfit > 0 ? "Cenário lucrativo" : platformProfit === 0 ? "Empate — sem lucro" : "PREJUÍZO"}
                </p>
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
                  value={fmt(buyerTotal - amount - SERVICE_FEE)}
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
                label={`Taxa VitraPay (${vpPctVal}% + ${fmt(vpFixedVal)})`}
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
              <Line label="Serviço líquido" value={`+ ${fmt(serviceFeeNet)}`} />
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
            <p>• Comprador paga {BUYER_INSTALLMENT_INTEREST_MONTHLY}% a.m. de juros a partir de 2x — repassado direto (não é lucro).</p>
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
            <FeeMethodRow key={m.id} icon={m.icon} label={m.label}
              pct={cfg.pct} fixed={cfg.fixed}
              onPctChange={(v) => setVp(m.id, "pct", v)}
              onFixedChange={(v) => setVp(m.id, "fixed", v)}
            />
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
