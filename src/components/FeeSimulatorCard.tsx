import { useState, useMemo } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Link2, BookOpen, Sparkles, Zap, Flame, Moon } from "lucide-react";

type Competitor = {
  id: string;
  name: string;
  percentage: number;
  fixed: number;
  Icon: typeof Link2;
};

const competitors: Competitor[] = [
  { id: "lastlink", name: "lastlink", percentage: 7.99, fixed: 1.0, Icon: Link2 },
  { id: "kirvano", name: "kirvano", percentage: 6.99, fixed: 1.49, Icon: BookOpen },
  { id: "perfectpay", name: "PerfectPay", percentage: 8.49, fixed: 1.5, Icon: Sparkles },
  { id: "ticto", name: "ticto", percentage: 9.9, fixed: 1.0, Icon: Zap },
  { id: "hotmart", name: "hotmart", percentage: 9.9, fixed: 0.99, Icon: Flame },
  { id: "kiwify", name: "kiwify", percentage: 8.99, fixed: 2.49, Icon: Moon },
];

const VITRA_PERCENTAGE = 3.99;
const VITRA_FIXED = 2.49;

const MIN_AMOUNT = 0;
const MAX_AMOUNT = 1_000_000;
const STEP = 500;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function FeeSimulatorCard() {
  const [amount, setAmount] = useState(10_000);
  const [selectedId, setSelectedId] = useState<string>("ticto");

  const selected = competitors.find((c) => c.id === selectedId)!;

  const result = useMemo(() => {
    const compFee = (amount * selected.percentage) / 100 + selected.fixed;
    const vitraFee = (amount * VITRA_PERCENTAGE) / 100 + VITRA_FIXED;
    const savings = Math.max(0, compFee - vitraFee);
    return { compFee, vitraFee, savings };
  }, [amount, selected]);

  return (
    <div className="relative rounded-[2rem] border border-white/[0.06] bg-[#0a0a0a] p-6 md:p-10 overflow-hidden">
      {/* Subtle ambient glows */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/[0.05] blur-[140px]" />

      <div className="relative space-y-10">
        {/* Header: Compare title + VitraPay badge */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-white/70 text-base md:text-lg">
            Compare os concorrentes com a:
          </p>
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-primary/[0.12] border border-primary/40 px-4 py-2.5 self-start md:self-auto shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-[#0a0a0a] font-black text-sm">V</span>
            </div>
            <span className="text-white font-bold text-base md:text-lg">VitraPay</span>
            <span className="text-primary font-bold text-sm md:text-base">{VITRA_PERCENTAGE.toString().replace(".", ",")}%</span>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-start">
          {/* LEFT — competitor selector */}
          <div className="space-y-5">
            <p className="text-white/60 text-sm md:text-base text-center md:text-left">
              Escolha uma plataforma para comparar:
            </p>
            <div className="grid grid-cols-3 gap-3">
              {competitors.map((c) => {
                const isActive = c.id === selectedId;
                const Icon = c.Icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`group relative aspect-[5/3] rounded-2xl border transition-all duration-200 flex items-center justify-center gap-1.5 px-2 ${
                      isActive
                        ? "border-primary bg-primary/[0.08] shadow-[0_0_0_1px_hsl(var(--primary)),0_0_25px_-5px_hsl(var(--primary)/0.5)]"
                        : "border-white/[0.06] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive ? "text-primary" : "text-white/35 group-hover:text-white/55"
                      }`}
                      strokeWidth={2.2}
                    />
                    <span
                      className={`text-sm font-semibold transition-colors ${
                        isActive ? "text-primary" : "text-white/45 group-hover:text-white/70"
                      }`}
                    >
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT — value + slider + comparison */}
          <div className="space-y-6">
            <div className="text-center md:text-right space-y-2">
              <p className="text-white/60 text-sm md:text-base">Se você vender</p>
              <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary tracking-tight tabular-nums leading-none">
                R${formatBRL(amount)}
              </p>
            </div>

            <SliderPrimitive.Root
              value={[amount]}
              onValueChange={(v) => setAmount(v[0])}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step={STEP}
              className="relative flex w-full touch-none select-none items-center pt-1"
            >
              <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-white/[0.06]">
                <SliderPrimitive.Range className="absolute h-full bg-white/10" />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb
                aria-label="Valor de vendas"
                className="block h-7 w-2 rounded-sm bg-primary shadow-[0_0_15px_hsl(var(--primary)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-transform hover:scale-110"
              />
            </SliderPrimitive.Root>

            {/* Comparison: side-by-side fees */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="text-center md:text-left space-y-1.5">
                <p className="text-white/55 text-xs md:text-sm">Taxas da concorrência</p>
                <p className="text-xl md:text-2xl font-bold text-white tabular-nums">
                  R${formatBRL(result.compFee)}
                </p>
              </div>
              <div className="text-center md:text-left space-y-1.5">
                <p className="text-white/55 text-xs md:text-sm">Taxas da VitraPay</p>
                <p className="text-xl md:text-2xl font-bold text-white tabular-nums">
                  R${formatBRL(result.vitraFee)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: savings highlight */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-5 pt-2">
          <p className="text-white/70 text-base md:text-lg">A VitraPay coloca no seu bolso:</p>
          <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary tabular-nums tracking-tight">
            +R${formatBRL(result.savings)}
          </p>
        </div>

        <div className="h-px bg-white/[0.05]" />

        <p className="text-center text-xs md:text-sm text-white/40 leading-relaxed max-w-3xl mx-auto">
          Esse é o valor que sua operação está deixando de lucrar diariamente devido às altas taxas dos outros gateways de pagamento.
        </p>
      </div>
    </div>
  );
}
