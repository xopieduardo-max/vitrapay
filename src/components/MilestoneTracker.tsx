import { useState, lazy, Suspense } from "react";
import tierStarter from "@/assets/tier-starter.webp";

import tierBronze from "@/assets/tier-bronze.webp";
import tierGold from "@/assets/tier-gold.webp";
import tierPlatinum from "@/assets/tier-platinum.webp";
import tierBlack from "@/assets/tier-black.webp";
import tierDiamond from "@/assets/tier-diamond.webp";
import tierSapphire from "@/assets/tier-sapphire.webp";
import tierRuby from "@/assets/tier-ruby.webp";

const BenefitsProgram = lazy(() =>
  import("@/components/BenefitsProgram").then((m) => ({ default: m.BenefitsProgram }))
);

// ─── Tiers ──────────────────────────────────────────────────────────────────
// Threshold = valor (em centavos). O usuário desbloqueia o tier ao atingir o threshold.
// Start 10k → Bronze 100k → Platinum 250k → Gold 500k → Black 1M → Diamond 5M → Sapphire 10M → Ruby 25M
export const TIERS = [
  { name: "Start", threshold: 1_000_000, label: "R$ 10k", image: tierStarter, glow: "rgba(255, 200, 30, 0.45)" },
  { name: "Bronze", threshold: 10_000_000, label: "R$ 100k", image: tierBronze, glow: "rgba(205, 127, 50, 0.45)" },
  { name: "Platinum", threshold: 25_000_000, label: "R$ 250k", image: tierPlatinum, glow: "rgba(220, 220, 230, 0.5)" },
  { name: "Gold", threshold: 50_000_000, label: "R$ 500k", image: tierGold, glow: "rgba(255, 200, 30, 0.55)" },
  { name: "Black", threshold: 100_000_000, label: "R$ 1M", image: tierBlack, glow: "rgba(40, 40, 40, 0.6)" },
  { name: "Diamond", threshold: 500_000_000, label: "R$ 5M", image: tierDiamond, glow: "rgba(180, 220, 255, 0.55)" },
  { name: "Sapphire", threshold: 1_000_000_000, label: "R$ 10M", image: tierSapphire, glow: "rgba(50, 100, 240, 0.55)" },
  { name: "Ruby", threshold: 2_500_000_000, label: "R$ 25M", image: tierRuby, glow: "rgba(220, 30, 60, 0.55)" },
] as const;

export function getTierIndex(revenue: number) {
  let idx = -1;
  for (let i = 0; i < TIERS.length; i++) {
    if (revenue >= TIERS[i].threshold) idx = i;
  }
  return idx;
}

const fmtBRL = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface Props {
  revenue: number;
  variant?: "compact" | "full";
}

export function MilestoneTracker({ revenue, variant = "full" }: Props) {
  const [open, setOpen] = useState(false);
  const currentIdx = getTierIndex(revenue);
  const display = currentIdx >= 0 ? TIERS[currentIdx] : TIERS[0];
  const next = currentIdx >= 0 ? TIERS[currentIdx + 1] : TIERS[0];

  const prevThreshold = currentIdx >= 0 ? display.threshold : 0;
  const nextThreshold = next?.threshold ?? display.threshold;
  const progress = next
    ? Math.min(100, Math.max(0, ((revenue - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100;
  const remaining = next ? Math.max(0, nextThreshold - revenue) : 0;
  const titleName = currentIdx >= 0 ? display.name : "Em busca do Start";

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6 transition-all hover:border-primary/40 h-full flex items-center"
        style={{
          background: `radial-gradient(circle at 0% 50%, ${display.glow}15 0%, transparent 50%), hsl(var(--card))`,
        }}
      >
        <div
          aria-hidden
          className="absolute -left-8 top-1/2 -translate-y-1/2 h-40 w-40 rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: display.glow }}
        />

        <div className="relative flex items-center gap-4 md:gap-5 w-full">
          <div className="relative flex-shrink-0">
            <img
              src={display.image}
              alt={display.name}
              className="h-20 w-20 md:h-24 md:w-24 lg:h-28 lg:w-28 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] tier-float"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-lg md:text-xl font-extrabold tracking-tight truncate">{titleName}</h3>
              <button
                onClick={() => setOpen(true)}
                className="text-xs md:text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap flex items-center gap-1"
              >
                Ver conquistas
              </button>
            </div>

            <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`,
                  boxShadow: `0 0 12px hsl(var(--primary) / 0.5)`,
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 text-xs md:text-sm flex-wrap">
              {next ? (
                <>
                  <span className="text-muted-foreground">
                    Próxima conquista: <strong className="text-foreground">{next.label}</strong>
                  </span>
                  {variant === "full" && (
                    <span className="text-muted-foreground hidden sm:inline">
                      Faltam <strong className="text-foreground">{fmtBRL(remaining)}</strong>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-primary font-bold">Nível máximo atingido!</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {open && (
        <Suspense fallback={null}>
          <BenefitsProgram open={open} onOpenChange={setOpen} revenue={revenue} />
        </Suspense>
      )}
    </>
  );
}
