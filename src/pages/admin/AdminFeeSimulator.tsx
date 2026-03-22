import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calculator, CreditCard, QrCode, Barcode, ArrowRight, ArrowDown, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const METHODS = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "card", label: "Cartão de Crédito", icon: CreditCard },
  { id: "boleto", label: "Boleto", icon: Barcode },
] as const;

// Asaas gateway costs — editable local state, defaults below
const ASAAS_DEFAULTS: Record<string, { pct: number; fixed: number; desc: string }> = {
  pix:    { pct: 0,    fixed: 199, desc: "R$ 1,99 por cobrança" },
  card:   { pct: 2.99, fixed: 49,  desc: "2,99% + R$ 0,49" },
  boleto: { pct: 0,    fixed: 199, desc: "R$ 1,99 por boleto" },
};

const fmt = (c: number) =>
  `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminFeeSimulator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("100");
  const [method, setMethod] = useState("pix");

  // Load fees from DB
  const { data: dbFees, isLoading } = useQuery({
    queryKey: ["platform-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_fees")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Local state for VitraPay fees editing
  const [vpPixPct, setVpPixPct] = useState<string | null>(null);
  const [vpPixFixed, setVpPixFixed] = useState<string | null>(null);
  const [vpCardPct, setVpCardPct] = useState<string | null>(null);
  const [vpCardFixed, setVpCardFixed] = useState<string | null>(null);
  const [vpBoletoPct, setVpBoletoPct] = useState<string | null>(null);
  const [vpBoletoFixed, setVpBoletoFixed] = useState<string | null>(null);

  // Local state for Asaas gateway costs editing
  const [asPixPct, setAsPixPct] = useState<string | null>(null);
  const [asPixFixed, setAsPixFixed] = useState<string | null>(null);
  const [asCardPct, setAsCardPct] = useState<string | null>(null);
  const [asCardFixed, setAsCardFixed] = useState<string | null>(null);
  const [asBoletoPct, setAsBoletoPct] = useState<string | null>(null);
  const [asBoletoFixed, setAsBoletoFixed] = useState<string | null>(null);

  // Effective VitraPay values
  const ePix = { pct: vpPixPct ?? String(dbFees?.pix_percentage ?? 0), fixed: vpPixFixed ?? String((dbFees?.pix_fixed ?? 0) / 100) };
  const eCard = { pct: vpCardPct ?? String(dbFees?.card_percentage ?? 3.89), fixed: vpCardFixed ?? String((dbFees?.card_fixed ?? 249) / 100) };
  const eBoleto = { pct: vpBoletoPct ?? String(dbFees?.boleto_percentage ?? 0), fixed: vpBoletoFixed ?? String((dbFees?.boleto_fixed ?? 0) / 100) };

  // Effective Asaas values (local edits or defaults)
  const eAsPix = { pct: asPixPct ?? String(ASAAS_DEFAULTS.pix.pct), fixed: asPixFixed ?? String(ASAAS_DEFAULTS.pix.fixed / 100) };
  const eAsCard = { pct: asCardPct ?? String(ASAAS_DEFAULTS.card.pct), fixed: asCardFixed ?? String(ASAAS_DEFAULTS.card.fixed / 100) };
  const eAsBoleto = { pct: asBoletoPct ?? String(ASAAS_DEFAULTS.boleto.pct), fixed: asBoletoFixed ?? String(ASAAS_DEFAULTS.boleto.fixed / 100) };

  const asConfig: Record<string, { pct: string; fixed: string }> = {
    pix: eAsPix, card: eAsCard, boleto: eAsBoleto,
  };

  const vpConfig: Record<string, { pct: string; fixed: string }> = {
    pix: ePix, card: eCard, boleto: eBoleto,
  };

  const amount = Math.round((parseFloat(value) || 0) * 100);

  // Asaas cost from editable values
  const currentAs = asConfig[method];
  const asaasPct = parseFloat(currentAs.pct) || 0;
  const asaasFixed = Math.round((parseFloat(currentAs.fixed) || 0) * 100);
  const asaasCost = Math.round(amount * (asaasPct / 100)) + asaasFixed;
  const asaasDesc = asaasPct > 0 && asaasFixed > 0 ? `${asaasPct}% + ${fmt(asaasFixed)}` : asaasPct > 0 ? `${asaasPct}%` : fmt(asaasFixed);

  const currentVp = vpConfig[method];
  const parsedPct = parseFloat(currentVp.pct) || 0;
  const parsedFixed = Math.round((parseFloat(currentVp.fixed) || 0) * 100);
  const vitraPayFee = Math.round(amount * (parsedPct / 100)) + parsedFixed;
  const vpDesc = parsedPct > 0 || parsedFixed > 0 ? `${parsedPct}% + ${fmt(parsedFixed)}` : "Sem taxa";

  // Producer pays BOTH: Asaas cost + VitraPay fee
  const totalDeducted = asaasCost + vitraPayFee;
  const producerReceives = amount - totalDeducted;
  // VitraPay keeps its fee as clean profit
  const vitraPayProfit = vitraPayFee;

  const methodInfo = METHODS.find((m) => m.id === method)!;

  // Check if values changed from DB
  const hasChanges = dbFees && (
    String(dbFees.pix_percentage) !== ePix.pct ||
    String((dbFees.pix_fixed) / 100) !== ePix.fixed ||
    String(dbFees.card_percentage) !== eCard.pct ||
    String((dbFees.card_fixed) / 100) !== eCard.fixed ||
    String(dbFees.boleto_percentage) !== eBoleto.pct ||
    String((dbFees.boleto_fixed) / 100) !== eBoleto.fixed
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("platform_fees")
        .update({
          pix_percentage: parseFloat(ePix.pct) || 0,
          pix_fixed: Math.round((parseFloat(ePix.fixed) || 0) * 100),
          card_percentage: parseFloat(eCard.pct) || 0,
          card_fixed: Math.round((parseFloat(eCard.fixed) || 0) * 100),
          boleto_percentage: parseFloat(eBoleto.pct) || 0,
          boleto_fixed: Math.round((parseFloat(eBoleto.fixed) || 0) * 100),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Taxas salvas com sucesso!" });
      // Reset local edits so they come from DB on next render
      setVpPixPct(null); setVpPixFixed(null);
      setVpCardPct(null); setVpCardFixed(null);
      setVpBoletoPct(null); setVpBoletoFixed(null);
      queryClient.invalidateQueries({ queryKey: ["platform-fees"] });
    },
    onError: (err: any) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Simulador de Taxas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simule quanto cada parte recebe e configure as taxas da plataforma
        </p>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Valor da venda (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="text-lg font-semibold max-w-xs"
            placeholder="100.00"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Forma de pagamento</Label>
          <div className="flex gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
                  method === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {amount > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-2">
              <methodInfo.icon className="h-4 w-4 text-primary" />
              {methodInfo.label} — Venda de {fmt(amount)}
            </p>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <SimRow label="Valor bruto da venda" value={fmt(amount)} color="text-foreground" bold />
              <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto" />
              <SimRow label="Custo Asaas (gateway)" sublabel={asaasDesc} value={`- ${fmt(asaasCost)}`} color="text-red-500" />
              <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto" />
              <SimRow
                label="Taxa VitraPay (cobrada do produtor)"
                sublabel={vpDesc}
                value={vitraPayFee > 0 ? `- ${fmt(vitraPayFee)}` : "R$ 0,00"}
                color={vitraPayFee > 0 ? "text-orange-500" : "text-muted-foreground"}
              />
            </div>

            <div className="border-t border-border" />

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    Produtor recebe
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {`${fmt(amount)} − ${fmt(asaasCost)} (Asaas) − ${fmt(vitraPayFee)} (VitraPay)`}
                  </p>
                </div>
                <span className="text-lg font-bold text-primary">{fmt(producerReceives)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Lucro VitraPay (líquido)</p>
                  <p className="text-xs text-muted-foreground">
                    Taxa cobrada do produtor: {fmt(vitraPayFee)}
                  </p>
                </div>
                <span className={cn(
                  "text-sm font-bold",
                  vitraPayProfit >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {fmt(vitraPayProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reference: Asaas */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Tabela de custos Asaas (referência)</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: QrCode, title: "Pix", fee: "R$ 1,99", note: "por cobrança recebida" },
            { icon: CreditCard, title: "Cartão", fee: "2,99% + R$ 0,49", note: "à vista · Receb. 32 dias" },
            { icon: Barcode, title: "Boleto", fee: "R$ 1,99", note: "por boleto pago" },
          ].map((item) => (
            <div key={item.title} className="space-y-1">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <item.icon className="h-3.5 w-3.5 text-primary" /> {item.title}
              </p>
              <p className="text-xs text-primary font-semibold">{item.fee}</p>
              <p className="text-[0.65rem] text-muted-foreground">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* VitraPay fees config per method */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Taxas VitraPay (cobradas do produtor)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure e salve as taxas. Elas serão aplicadas automaticamente em todas as vendas.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
          >
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar taxas
          </Button>
        </div>

        <div className="space-y-4">
          <FeeMethodRow icon={QrCode} label="Pix" pct={ePix.pct} fixed={ePix.fixed} onPctChange={setVpPixPct} onFixedChange={setVpPixFixed} />
          <FeeMethodRow icon={CreditCard} label="Cartão" pct={eCard.pct} fixed={eCard.fixed} onPctChange={setVpCardPct} onFixedChange={setVpCardFixed} />
          <FeeMethodRow icon={Barcode} label="Boleto" pct={eBoleto.pct} fixed={eBoleto.fixed} onPctChange={setVpBoletoPct} onFixedChange={setVpBoletoFixed} />
        </div>
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
      <div className="flex items-center gap-2 min-w-[100px]">
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

function SimRow({ label, sublabel, value, color, bold }: {
  label: string; sublabel?: string; value: string; color: string; bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={cn("text-sm", bold ? "font-semibold" : "font-medium")}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <span className={cn("text-sm font-bold", color)}>{value}</span>
    </div>
  );
}
