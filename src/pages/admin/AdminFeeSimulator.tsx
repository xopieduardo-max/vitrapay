import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, CreditCard, QrCode, Barcode, ArrowRight } from "lucide-react";

const PAYMENT_METHODS = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "card", label: "Cartão de Crédito", icon: CreditCard },
  { id: "boleto", label: "Boleto Bancário", icon: Barcode },
];

// Asaas fees (production rates)
const ASAAS_FEES: Record<string, { percent: number; fixed: number; label: string }> = {
  pix: { percent: 0, fixed: 199, label: "R$ 1,99 por cobrança" },
  card: { percent: 2.99, fixed: 49, label: "2,99% + R$ 0,49 à vista" },
  boleto: { percent: 0, fixed: 199, label: "R$ 1,99 por boleto" },
};

// VitraPay default fees
const VITRAPAY_DEFAULT = { percent: 3.89, fixed: 249 };

const fmt = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminFeeSimulator() {
  const [saleValue, setSaleValue] = useState("100");
  const [method, setMethod] = useState("pix");
  const [customPercent, setCustomPercent] = useState("");
  const [customFixed, setCustomFixed] = useState("");

  const amountCents = Math.round((parseFloat(saleValue) || 0) * 100);

  // VitraPay fee (what we charge the producer)
  const vpPercent = customPercent !== "" ? parseFloat(customPercent) : VITRAPAY_DEFAULT.percent;
  const vpFixed = customFixed !== "" ? Math.round(parseFloat(customFixed) * 100) : VITRAPAY_DEFAULT.fixed;
  const vitraPayFee = method === "pix"
    ? 0
    : Math.round(amountCents * (vpPercent / 100)) + vpFixed;

  // Asaas fee (what Asaas charges us)
  const asaasFee = ASAAS_FEES[method];
  const asaasCost = Math.round(amountCents * (asaasFee.percent / 100)) + asaasFee.fixed;

  // Producer receives
  const producerReceives = amountCents - vitraPayFee;

  // VitraPay profit
  const vitraPayProfit = vitraPayFee - asaasCost;

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

      {/* Input form */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor da venda (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={saleValue}
              onChange={(e) => setSaleValue(e.target.value)}
              className="text-lg font-semibold"
              placeholder="100.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <m.icon className="h-4 w-4" />
                      {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom VitraPay fee override */}
        <div className="border-t border-border pt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">
            Taxa VitraPay customizada (opcional — padrão: {VITRAPAY_DEFAULT.percent}% + {fmt(VITRAPAY_DEFAULT.fixed)})
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[0.65rem] text-muted-foreground">Porcentagem (%)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={VITRAPAY_DEFAULT.percent.toString()}
                value={customPercent}
                onChange={(e) => setCustomPercent(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem] text-muted-foreground">Fixo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={(VITRAPAY_DEFAULT.fixed / 100).toFixed(2)}
                value={customFixed}
                onChange={(e) => setCustomFixed(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {amountCents > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">Resultado da simulação</h3>
            <p className="text-xs text-muted-foreground">
              {PAYMENT_METHODS.find((m) => m.id === method)?.label} — Venda de {fmt(amountCents)}
            </p>
          </div>

          <div className="divide-y divide-border">
            {/* Asaas */}
            <FeeRow
              label="Taxa Asaas (custo gateway)"
              detail={asaasFee.label}
              value={asaasCost}
              color="text-red-500"
            />

            {/* VitraPay */}
            <FeeRow
              label="Taxa VitraPay (cobrada do produtor)"
              detail={method === "pix" ? "Isento para Pix" : `${vpPercent}% + ${fmt(vpFixed)}`}
              value={vitraPayFee}
              color="text-orange-500"
            />

            {/* VitraPay profit */}
            <FeeRow
              label="Lucro VitraPay (taxa − custo Asaas)"
              detail={vitraPayProfit < 0 ? "⚠️ Prejuízo nesta venda" : "Margem líquida"}
              value={vitraPayProfit}
              color={vitraPayProfit >= 0 ? "text-emerald-500" : "text-red-500"}
            />

            {/* Producer */}
            <div className="flex items-center justify-between px-5 py-4 bg-primary/5">
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  Produtor recebe
                </p>
                <p className="text-xs text-muted-foreground">Valor bruto − taxa VitraPay</p>
              </div>
              <span className="text-lg font-bold text-primary">{fmt(producerReceives)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Reference table */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Tabela de taxas Asaas (referência)</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5 text-primary" /> Pix
            </p>
            <p className="text-xs text-primary font-semibold">R$ 1,99</p>
            <p className="text-[0.65rem] text-muted-foreground">por cobrança recebida</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-primary" /> Cartão de Crédito
            </p>
            <p className="text-xs text-primary font-semibold">2,99% + R$ 0,49</p>
            <p className="text-[0.65rem] text-muted-foreground">à vista · Recebimento em 32 dias</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Barcode className="h-3.5 w-3.5 text-primary" /> Boleto
            </p>
            <p className="text-xs text-primary font-semibold">R$ 1,99</p>
            <p className="text-[0.65rem] text-muted-foreground">por boleto pago</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeeRow({ label, detail, value, color }: { label: string; detail: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className={`text-sm font-bold ${color}`}>{fmt(value)}</span>
    </div>
  );
}

const fmt2 = fmt; // alias for reuse
