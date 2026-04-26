import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";

type Competitor = {
  id: string;
  name: string;
  percentage: number;
  fixed: number;
};

const competitors: Competitor[] = [
  { id: "lastlink", name: "Lastlink", percentage: 7.99, fixed: 1.0 },
  { id: "kirvano", name: "Kirvano", percentage: 6.99, fixed: 1.49 },
  { id: "perfectpay", name: "PerfectPay", percentage: 8.49, fixed: 1.5 },
  { id: "ticto", name: "Ticto", percentage: 9.9, fixed: 1.0 },
  { id: "hotmart", name: "Hotmart", percentage: 9.9, fixed: 0.99 },
  { id: "kiwify", name: "Kiwify", percentage: 8.99, fixed: 2.49 },
];

const VITRA_PERCENTAGE = 3.99;
const VITRA_FIXED = 2.49;

const MIN_AMOUNT = 0;
const MAX_AMOUNT = 1_000_000;
const STEP = 1000;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBRLShort(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function FeeSimulatorCard() {
  const [amount, setAmount] = useState(10_000);
  const [selectedId, setSelectedId] = useState<string>("hotmart");

  const selected = competitors.find((c) => c.id === selectedId)!;

  const result = useMemo(() => {
    const compFee = (amount * selected.percentage) / 100 + selected.fixed;
    const vitraFee = (amount * VITRA_PERCENTAGE) / 100 + VITRA_FIXED;
    const savings = Math.max(0, compFee - vitraFee);
    return {
      compFee,
      vitraFee,
      savings,
    };
  }, [amount, selected]);

  return (
    <div className="relative rounded-3xl border border-white/[0.06] bg-[#0d0d0d] p-6 md:p-10 overflow-hidden shadow-2xl shadow-black/40">
      {/* Glow accents */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-white/60 text-sm md:text-base">
            Compare os concorrentes com a:
          </p>
          <div className="inline-flex items-center gap-2 rounded-xl bg-primary/15 border border-primary/30 px-4 py-2 self-start md:self-auto">
            <span className="text-primary font-bold text-base md:text-lg">VitraPay</span>
            <span className="text-primary/80 text-sm font-semibold">{VITRA_PERCENTAGE.toString().replace(".", ",")}%</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-10">
          {/* LEFT — competitor selector */}
          <div className="space-y-4">
            <p className="text-white/60 text-sm">Escolha uma plataforma para comparar:</p>
            <div className="grid grid-cols-3 gap-2.5">
              {competitors.map((c) => {
                const isActive = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`group relative aspect-[5/3] rounded-xl border text-xs md:text-sm font-semibold transition-all duration-200 flex items-center justify-center px-2 ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_0_1px_hsl(var(--primary))] shadow-primary/30"
                        : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white/90 hover:border-white/20"
                    }`}
                  >
                    <span className="relative z-10">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT — slider + value */}
          <div className="space-y-4">
            <p className="text-white/60 text-sm text-center md:text-right">Se você vender</p>
            <p className="text-center md:text-right text-3xl md:text-5xl font-bold text-primary tracking-tight tabular-nums">
              R$ {formatBRLShort(amount)}
            </p>
            <Slider
              value={[amount]}
              onValueChange={(v) => setAmount(v[0])}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step={STEP}
              className="pt-2"
            />
            <div className="flex justify-between text-xs text-white/40">
              <span>R$ 0</span>
              <span>R$ 1M</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Comparison cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5 text-center">
            <p className="text-xs md:text-sm text-white/50 mb-2">Taxas {selected.name}</p>
            <p className="text-xl md:text-2xl font-bold text-white tabular-nums">
              R$ {formatBRL(result.compFee)}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 md:p-5 text-center">
            <p className="text-xs md:text-sm text-primary/80 mb-2">Taxas VitraPay</p>
            <p className="text-xl md:text-2xl font-bold text-primary tabular-nums">
              R$ {formatBRL(result.vitraFee)}
            </p>
          </div>
        </div>

        {/* Savings highlight */}
        <div className="rounded-2xl bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border border-primary/30 px-5 py-5 md:px-6 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-center md:text-left">
          <p className="text-white/80 text-sm md:text-base">
            A VitraPay coloca no seu bolso:
          </p>
          <p className="text-2xl md:text-4xl font-bold text-primary tabular-nums tracking-tight">
            +R$ {formatBRL(result.savings)}
          </p>
        </div>

        <p className="text-center text-xs md:text-sm text-white/40 leading-relaxed">
          Esse é o valor que sua operação está deixando de lucrar devido às altas taxas dos outros gateways de pagamento.
        </p>
      </div>
    </div>
  );
}
