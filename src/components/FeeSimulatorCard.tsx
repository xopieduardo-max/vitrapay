import { useState, useMemo } from "react";

const competitors = [
  { name: "Hotmart", percentage: 9.9, fixed: 0.99 },
  { name: "Kiwify", percentage: 8.99, fixed: 2.49 },
];

const plans = [
  { label: "D+30 Padrão", percentage: 3.99, fixed: 2.49 },
  { label: "D+2 Antecipação", percentage: 4.99, fixed: 2.49 },
];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FeeSimulatorCard() {
  const [amount, setAmount] = useState(100);
  const [planIdx, setPlanIdx] = useState(0);

  const plan = plans[planIdx];

  const results = useMemo(() => {
    const vitrapay = amount - (amount * plan.percentage / 100) - plan.fixed;
    const comp = competitors.map(c => ({
      name: c.name,
      net: Math.max(0, amount - (amount * c.percentage / 100) - c.fixed),
      feeText: `${c.percentage.toFixed(2).replace(".", ",")}% + R$ ${formatBRL(c.fixed)}`,
    }));
    return {
      vitrapay: Math.max(0, vitrapay),
      vitraFeeText: `${plan.percentage.toFixed(2).replace(".", ",")}% + R$ ${formatBRL(plan.fixed)}`,
      competitors: comp,
    };
  }, [amount, plan]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setAmount(Number(raw) / 100 || 0);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111a11] p-6 md:p-8 space-y-6 shadow-2xl shadow-black/40">
      {/* Value input */}
      <div className="space-y-3">
        <p className="font-semibold text-white text-lg">Se você vender</p>
        <input
          type="text"
          inputMode="numeric"
          value={`R$ ${formatBRL(amount)}`}
          onChange={handleInputChange}
          className="w-full text-center text-lg font-medium rounded-xl border border-white/15 bg-white/5 py-3.5 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Plan toggle */}
      <div className="flex rounded-xl bg-white/5 p-1 gap-1">
        {plans.map((p, i) => (
          <button
            key={i}
            onClick={() => setPlanIdx(i)}
            className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 ${
              planIdx === i
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="h-px bg-white/10" />

      {/* Competitor cards */}
      <div className="space-y-3">
        {results.competitors.map((c, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 flex items-end justify-between transition-colors hover:bg-white/[0.05]"
          >
            <div className="space-y-1">
              <p className="text-sm text-white/40">No '{c.name}' você recebe</p>
              <p className="text-2xl font-bold text-white">R$ {formatBRL(c.net)}</p>
            </div>
            <p className="text-sm text-white/40">{c.feeText}</p>
          </div>
        ))}
      </div>

      {/* VitraPay highlight */}
      <div className="rounded-2xl bg-primary p-5 flex items-end justify-between shadow-lg shadow-primary/25 ring-1 ring-primary/50">
        <div className="space-y-1">
          <p className="text-sm text-primary-foreground/70 font-medium">Na VitraPay você recebe</p>
          <p className="text-2xl font-bold text-primary-foreground">R$ {formatBRL(results.vitrapay)}</p>
        </div>
        <p className="text-sm font-semibold text-primary-foreground/70">{results.vitraFeeText}</p>
      </div>
    </div>
  );
}
