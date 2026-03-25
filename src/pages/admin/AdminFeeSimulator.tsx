import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calculator, CreditCard, QrCode, Barcode, Save, Loader2, TrendingUp, TrendingDown, Building2, Landmark, User, Percent, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const METHODS = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "card", label: "Cartão de Crédito", icon: CreditCard },
  { id: "boleto", label: "Boleto", icon: Barcode },
] as const;

const ASAAS_DEFAULTS: Record<string, { pct: number; fixed: number }> = {
  pix:    { pct: 0,    fixed: 199 },
  card:   { pct: 3.49, fixed: 49 },
  boleto: { pct: 0,    fixed: 199 },
};

const VP_DEFAULTS: Record<string, { pct: number; fixed: number }> = {
  pix:    { pct: 0,    fixed: 399 },
  card:   { pct: 6.99, fixed: 100 },
  boleto: { pct: 0,    fixed: 399 },
};

const fmt = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

export default function AdminFeeSimulator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("100");
  const [method, setMethod] = useState("pix");

  const { data: dbFees, isLoading } = useQuery({
    queryKey: ["platform-fees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_fees").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  // Asaas editable state
  const [asState, setAsState] = useState<Record<string, { pct: string; fixed: string }>>({});
  const getAs = (m: string) => ({
    pct: asState[m]?.pct ?? String(ASAAS_DEFAULTS[m].pct),
    fixed: asState[m]?.fixed ?? String(ASAAS_DEFAULTS[m].fixed / 100),
  });
  const setAs = (m: string, field: "pct" | "fixed", v: string) =>
    setAsState((prev) => ({ ...prev, [m]: { ...getAs(m), [field]: v } }));

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

  // Service fee (R$0.99 per transaction, paid by buyer)
  const SERVICE_FEE = 99;

  // Asaas cost (internal, invisible to producer)
  const asCfg = getAs(method);
  const asaasPctVal = parseFloat(asCfg.pct) || 0;
  const asaasFixedVal = Math.round((parseFloat(asCfg.fixed) || 0) * 100);
  const feeAsaas = Math.round(amount * (asaasPctVal / 100)) + asaasFixedVal;

  // VitraPay fee (the ONLY fee the producer sees/pays)
  const vpCfg = getVp(method);
  const vpPctVal = parseFloat(vpCfg.pct) || 0;
  const vpFixedVal = Math.round((parseFloat(vpCfg.fixed) || 0) * 100);
  const feePlatform = Math.round(amount * (vpPctVal / 100)) + vpFixedVal;

  // Service fee net: on PIX no extra gateway cost; on card Asaas charges % on it
  const serviceFeeGatewayCost = method === "pix" ? 0 : Math.round(SERVICE_FEE * (asaasPctVal / 100));
  const serviceFeeNet = SERVICE_FEE - serviceFeeGatewayCost;

  // KEY: Producer pays ONLY feePlatform. Asaas is absorbed internally.
  const producerReceives = amount - feePlatform;
  // Platform profit = what VitraPay keeps after paying Asaas
  const platformProfit = feePlatform - feeAsaas;
  // Total profit including service fee
  const totalProfit = platformProfit + serviceFeeNet;

  const pctPlatformOnSale = amount > 0 ? (feePlatform / amount) * 100 : 0;
  const pctAsaasOnSale = amount > 0 ? (feeAsaas / amount) * 100 : 0;

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
      toast({ title: "✅ Taxas salvas com sucesso!" });
      setVpState({});
      queryClient.invalidateQueries({ queryKey: ["platform-fees"] });
    },
    onError: (err: any) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const methodInfo = METHODS.find((m) => m.id === method)!;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Simulador de Taxas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ferramenta de decisão — taxa única cobrada do produtor (já inclui gateway)
        </p>
      </div>

      {/* Input */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Valor da venda (R$)</Label>
          <Input
            type="number" step="0.01" min="5"
            value={value} onChange={(e) => setValue(e.target.value)}
            className="text-lg font-semibold max-w-xs"
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
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
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

      {/* Results */}
      {isValid && amount > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-2">
              <methodInfo.icon className="h-4 w-4 text-primary" />
              {methodInfo.label} — Venda de {fmt(amount)}
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Valor bruto */}
            <ResultRow
              icon={<TrendingUp className="h-4 w-4" />}
              label="Valor bruto da venda"
              value={fmt(amount)}
              valueColor="text-foreground"
              bold
            />

            <div className="border-t border-border" />

            {/* Taxa VitraPay (única taxa visível pro produtor) */}
            <ResultRow
              icon={<Building2 className="h-4 w-4" />}
              label="Taxa VitraPay (cobrada do produtor)"
              sublabel={vpPctVal > 0 ? `${vpPctVal}% + ${fmt(vpFixedVal)}` : fmt(vpFixedVal)}
              value={`- ${fmt(feePlatform)}`}
              badge={fmtPct(pctPlatformOnSale)}
              valueColor="text-destructive"
            />

            <div className="border-t border-border" />

            {/* Produtor recebe */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Produtor recebe (líquido)</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(amount)} − {fmt(feePlatform)} (taxa VitraPay)
                  </p>
                </div>
              </div>
              <span className={cn("text-lg font-bold", producerReceives >= 0 ? "text-primary" : "text-destructive")}>
                {fmt(producerReceives)}
              </span>
            </div>

            <div className="border-t border-dashed border-border" />

            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Visão interna da plataforma</p>

            {/* Custo Asaas (interno) */}
            <ResultRow
              icon={<Landmark className="h-4 w-4" />}
              label="Custo gateway (Asaas)"
              sublabel={asaasPctVal > 0 ? `${asaasPctVal}% + ${fmt(asaasFixedVal)}` : fmt(asaasFixedVal)}
              value={`- ${fmt(feeAsaas)}`}
              badge={fmtPct(pctAsaasOnSale)}
              valueColor="text-destructive"
            />

            {/* Lucro plataforma */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              platformProfit >= 0 ? "bg-emerald-500/5 border-emerald-500/10" : "bg-destructive/5 border-destructive/10"
            )}>
              <div className="flex items-center gap-2">
                {platformProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-semibold">Lucro VitraPay</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(feePlatform)} (taxa cobrada) − {fmt(feeAsaas)} (custo Asaas)
                  </p>
                </div>
              </div>
              <span className={cn("text-lg font-bold", platformProfit >= 0 ? "text-emerald-500" : "text-destructive")}>
                {fmt(platformProfit)}
              </span>
            </div>

            {/* Taxa de serviço */}
            <ResultRow
              icon={<Receipt className="h-4 w-4" />}
              label="Taxa de serviço (paga pelo comprador)"
              sublabel={`R$ 0,99 bruto${serviceFeeGatewayCost > 0 ? ` − ${fmt(serviceFeeGatewayCost)} gateway` : ""}`}
              value={`+ ${fmt(serviceFeeNet)}`}
              valueColor="text-amber-500"
            />

            {/* Lucro total por transação */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border-2",
              totalProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"
            )}>
              <div className="flex items-center gap-2">
                {totalProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-bold">Lucro total por transação</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(platformProfit)} (taxa) + {fmt(serviceFeeNet)} (serviço)
                  </p>
                </div>
              </div>
              <span className={cn("text-xl font-bold", totalProfit >= 0 ? "text-emerald-500" : "text-destructive")}>
                {fmt(totalProfit)}
              </span>
            </div>

            {platformProfit < 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <p className="text-xs font-medium text-destructive">
                  ⚠️ Prejuízo! A taxa cobrada não cobre o custo do gateway. Aumente as taxas VitraPay.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editable Asaas costs */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Custos Asaas (gateway) — uso interno
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edite para simular cenários. O produtor não vê estes valores.
          </p>
        </div>
        {METHODS.map((m) => {
          const cfg = getAs(m.id);
          return (
            <FeeMethodRow key={m.id} icon={m.icon} label={m.label}
              pct={cfg.pct} fixed={cfg.fixed}
              onPctChange={(v) => setAs(m.id, "pct", v)}
              onFixedChange={(v) => setAs(m.id, "fixed", v)}
            />
          );
        })}
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

function ResultRow({ icon, label, sublabel, value, badge, valueColor, bold }: {
  icon: React.ReactNode; label: string; sublabel?: string; value: string;
  badge?: string; valueColor: string; bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <div>
          <p className={cn("text-sm", bold ? "font-semibold" : "font-medium")}>{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {badge}
          </span>
        )}
        <span className={cn("text-sm font-bold", valueColor)}>{value}</span>
      </div>
    </div>
  );
}
