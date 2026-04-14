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
      net: amount - (amount * c.percentage / 100) - c.fixed,
      feeText: `${c.percentage.toFixed(2).replace(".", ",")}% + R$ ${formatBRL(c.fixed)}`,
    }));
    return {
      vitrapay: Math.max(0, vitrapay),
      vitraFeeText: `${plan.percentage.toFixed(2).replace(".", ",")}% + R$ ${formatBRL(plan.fixed)}`,
      competitors: comp.map(c => ({ ...c, net: Math.max(0, c.net) })),
    };
  }, [amount, plan]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setAmount(Number(raw) / 100 || 0);
  };

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-6 md:p-8 space-y-6 shadow-xl">
      {/* Value input */}
      <div className="space-y-3">
        <p className="font-semibold text-foreground">Se você vender</p>
        <input
          type="text"
          inputMode="numeric"
          value={`R$ ${formatBRL(amount)}`}
          onChange={handleInputChange}
          className="w-full text-center text-lg font-medium rounded-xl border border-border/60 bg-muted/40 py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />
      </div>

      {/* Plan toggle */}
      <div className="flex rounded-xl bg-muted/50 p-1 gap-1">
        {plans.map((p, i) => (
          <button
            key={i}
            onClick={() => setPlanIdx(i)}
            className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all ${
              planIdx === i
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="h-px bg-border/50" />

      {/* Competitor cards */}
      <div className="space-y-3">
        {results.competitors.map((c, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/40 bg-muted/30 p-5 flex items-end justify-between"
          >
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">No '{c.name}' você recebe</p>
              <p className="text-2xl font-bold text-foreground">R$ {formatBRL(c.net)}</p>
            </div>
            <p className="text-sm text-muted-foreground">{c.feeText}</p>
          </div>
        ))}
      </div>

      {/* VitraPay highlight */}
      <div className="rounded-2xl bg-primary p-5 flex items-end justify-between shadow-lg shadow-primary/20">
        <div className="space-y-1">
          <p className="text-sm text-primary-foreground/80">Na VitraPay você recebe</p>
          <p className="text-2xl font-bold text-primary-foreground">R$ {formatBRL(results.vitrapay)}</p>
        </div>
        <p className="text-sm font-medium text-primary-foreground/80">{results.vitraFeeText}</p>
      </div>
    </div>
  );
}
