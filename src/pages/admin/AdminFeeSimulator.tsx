import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, CreditCard, QrCode, Barcode, ArrowRight, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

const METHODS = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "card", label: "Cartão de Crédito", icon: CreditCard },
  { id: "boleto", label: "Boleto", icon: Barcode },
] as const;

// Asaas gateway costs (what WE pay to Asaas)
const ASAAS: Record<string, { pct: number; fixed: number; desc: string }> = {
  pix:    { pct: 0,    fixed: 199, desc: "R$ 1,99 por cobrança" },
  card:   { pct: 2.99, fixed: 49,  desc: "2,99% + R$ 0,49" },
  boleto: { pct: 0,    fixed: 199, desc: "R$ 1,99 por boleto" },
};

// VitraPay platform fee defaults per method
const VP_DEFAULTS: Record<string, { pct: number; fixed: number }> = {
  pix:    { pct: 0, fixed: 0 },
  card:   { pct: 3.89, fixed: 249 },
  boleto: { pct: 0, fixed: 0 },
};

const fmt = (c: number) =>
  `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminFeeSimulator() {
  const [value, setValue] = useState("100");
  const [method, setMethod] = useState("pix");

  // VitraPay fees per method
  const [vpPixPct, setVpPixPct] = useState("0");
  const [vpPixFixed, setVpPixFixed] = useState("0");
  const [vpCardPct, setVpCardPct] = useState("3.89");
  const [vpCardFixed, setVpCardFixed] = useState("2.49");
  const [vpBoletoPct, setVpBoletoPct] = useState("0");
  const [vpBoletoFixed, setVpBoletoFixed] = useState("0");

  const vpConfig: Record<string, { pct: string; fixed: string }> = {
    pix:    { pct: vpPixPct, fixed: vpPixFixed },
    card:   { pct: vpCardPct, fixed: vpCardFixed },
    boleto: { pct: vpBoletoPct, fixed: vpBoletoFixed },
  };

  const amount = Math.round((parseFloat(value) || 0) * 100);

  const asaas = ASAAS[method];
  const asaasCost = Math.round(amount * (asaas.pct / 100)) + asaas.fixed;

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Simulador de Taxas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simule quanto cada parte recebe em uma venda
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
            {/* Flow visual */}
            <div className="space-y-3">
              {/* Step 1: Sale amount */}
              <SimRow
                label="Valor bruto da venda"
                value={fmt(amount)}
                color="text-foreground"
                bold
              />

              <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto" />

              {/* Step 2: Asaas cost */}
              <SimRow
                label="Custo Asaas (gateway)"
                sublabel={asaas.desc}
                value={`- ${fmt(asaasCost)}`}
                color="text-red-500"
              />

              <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto" />

              {/* Step 3: VitraPay fee */}
              <SimRow
                label="Taxa VitraPay (cobrada do produtor)"
                sublabel={vpDesc}
                value={vitraPayFee > 0 ? `- ${fmt(vitraPayFee)}` : "R$ 0,00"}
                color={vitraPayFee > 0 ? "text-orange-500" : "text-muted-foreground"}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Results */}
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
        <h3 className="text-sm font-semibold">Taxas VitraPay (cobradas do produtor)</h3>
        <p className="text-xs text-muted-foreground">
          Configure a taxa de cada forma de pagamento. Os valores são usados no cálculo acima.
        </p>

        <div className="space-y-4">
          {/* Pix */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 min-w-[100px]">
              <QrCode className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Pix</span>
            </div>
            <div className="flex gap-3 flex-1 max-w-xs">
              <div className="space-y-1 flex-1">
                <Label className="text-[0.65rem] text-muted-foreground">% sobre venda</Label>
                <Input type="number" step="0.01" min="0" value={vpPixPct} onChange={(e) => setVpPixPct(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-[0.65rem] text-muted-foreground">Fixo (R$)</Label>
                <Input type="number" step="0.01" min="0" value={vpPixFixed} onChange={(e) => setVpPixFixed(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Cartão */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 min-w-[100px]">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Cartão</span>
            </div>
            <div className="flex gap-3 flex-1 max-w-xs">
              <div className="space-y-1 flex-1">
                <Label className="text-[0.65rem] text-muted-foreground">% sobre venda</Label>
                <Input type="number" step="0.01" min="0" value={vpCardPct} onChange={(e) => setVpCardPct(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-[0.65rem] text-muted-foreground">Fixo (R$)</Label>
                <Input type="number" step="0.01" min="0" value={vpCardFixed} onChange={(e) => setVpCardFixed(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Boleto */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 min-w-[100px]">
              <Barcode className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Boleto</span>
            </div>
            <div className="flex gap-3 flex-1 max-w-xs">
              <div className="space-y-1 flex-1">
                <Label className="text-[0.65rem] text-muted-foreground">% sobre venda</Label>
                <Input type="number" step="0.01" min="0" value={vpBoletoPct} onChange={(e) => setVpBoletoPct(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-[0.65rem] text-muted-foreground">Fixo (R$)</Label>
                <Input type="number" step="0.01" min="0" value={vpBoletoFixed} onChange={(e) => setVpBoletoFixed(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimRow({ label, sublabel, value, color, bold }: {
  label: string;
  sublabel?: string;
  value: string;
  color: string;
  bold?: boolean;
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
