import { useState, lazy, Suspense } from "react";
import { Info, Lock, Check } from "lucide-react";
import tierStarter from "@/assets/tier-starter.webp";

import tierBronze from "@/assets/tier-bronze.webp";
import tierGold from "@/assets/tier-gold.webp";
import tierPlatinum from "@/assets/tier-platinum.webp";
import tierBlack from "@/assets/tier-black.webp";
import tierDiamond from "@/assets/tier-diamond.webp";
import tierSapphire from "@/assets/tier-sapphire.webp";
import tierRuby from "@/assets/tier-ruby.webp";

const Dialog = lazy(() => import("@/components/ui/dialog").then(m => ({ default: m.Dialog })));
const DialogContent = lazy(() => import("@/components/ui/dialog").then(m => ({ default: m.DialogContent })));
const DialogHeader = lazy(() => import("@/components/ui/dialog").then(m => ({ default: m.DialogHeader })));
const DialogTitle = lazy(() => import("@/components/ui/dialog").then(m => ({ default: m.DialogTitle })));

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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const currentIdx = getTierIndex(revenue);
  // Quando ainda não conquistou nenhum tier, exibimos o Start como "alvo".
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
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6 transition-all hover:border-primary/40"
        style={{
          background: `radial-gradient(circle at 0% 50%, ${display.glow}15 0%, transparent 50%), hsl(var(--card))`,
        }}
      >
        {/* Soft glow behind badge */}
        <div
          aria-hidden
          className="absolute -left-8 top-1/2 -translate-y-1/2 h-40 w-40 rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: display.glow }}
        />

        <div className="relative flex items-center gap-4 md:gap-5">
          {/* Tier badge - large 3D image */}
          <div className="relative flex-shrink-0">
            <img
              src={display.image}
              alt={display.name}
              className={`h-20 w-20 md:h-24 md:w-24 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] tier-float ${
                currentIdx < 0 ? "grayscale opacity-60" : ""
              }`}
              loading="lazy"
            />
          </div>

          {/* Info column */}
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

            {/* Progress bar */}
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

            {/* Bottom labels */}
            <div className="flex items-center justify-between text-xs md:text-sm">
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

      {/* Achievements Dialog (lazy mounted only when opened) */}
      {open && (
        <Suspense fallback={null}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <img src={display.image} alt="" className="h-10 w-10 object-contain" decoding="async" />
                  <div>
                    <p className="text-base font-bold">{titleName}</p>
                    {next && (
                      <p className="text-xs font-normal text-muted-foreground mt-0.5">
                        Próxima conquista: <strong>{next.label}</strong>
                      </p>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Top progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden -mt-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`,
                  }}
                />
              </div>

              {/* Tier grid 3x3 */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 pt-3">
                {TIERS.map((tier, i) => {
                  const reached = i <= currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <button
                      type="button"
                      key={tier.name}
                      onClick={() => setSelectedIdx(i)}
                      className={`group relative flex flex-col items-center justify-center text-center p-3 md:p-4 rounded-xl border transition-all hover:scale-[1.03] hover:border-primary/60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        isCurrent
                          ? "border-primary/60 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
                          : reached
                            ? "border-border bg-card"
                            : "border-border/60 bg-muted/20"
                      }`}
                    >
                      {reached && !isCurrent && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                        </div>
                      )}
                      {!reached && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                          <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                        </div>
                      )}
                      <img
                        src={tier.image}
                        alt={tier.name}
                        width={80}
                        height={80}
                        decoding="async"
                        className={`h-16 w-16 md:h-20 md:w-20 object-contain mb-2 transition-all group-hover:scale-110 ${
                          reached ? "drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]" : "opacity-30 saturate-50"
                        }`}
                      />
                      <p className={`text-sm font-bold ${reached ? "text-foreground" : "text-muted-foreground/70"}`}>
                        {tier.name}
                      </p>
                      <p className={`text-xs mt-0.5 ${reached ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                        {tier.label}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Footer note */}
              <div className="flex items-start gap-2 mt-2 p-3 rounded-lg border border-border/60 bg-muted/30">
                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Os níveis consideram o total transacionado bruto, isento de taxas ou deduções.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </Suspense>
      )}

      {/* Tier detail dialog - large badge view */}
      {selectedIdx !== null && (
        <Suspense fallback={null}>
          <Dialog open={selectedIdx !== null} onOpenChange={(o) => !o && setSelectedIdx(null)}>
            <DialogContent className="sm:max-w-md text-center overflow-hidden">
              {(() => {
                const tier = TIERS[selectedIdx];
                const reached = selectedIdx <= currentIdx;
                return (
                  <>
                    {/* Glow background */}
                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none opacity-60"
                      style={{
                        background: `radial-gradient(circle at 50% 30%, ${tier.glow}, transparent 65%)`,
                      }}
                    />
                    <div className="relative flex flex-col items-center pt-2 pb-1">
                      <DialogHeader>
                        <DialogTitle className="sr-only">{tier.name}</DialogTitle>
                      </DialogHeader>

                      {/* Big badge */}
                      <div className="relative">
                        <img
                          src={tier.image}
                          alt={tier.name}
                          width={240}
                          height={240}
                          decoding="async"
                          className={`h-48 w-48 md:h-56 md:w-56 object-contain tier-float drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] ${
                            reached ? "" : "opacity-40 saturate-50"
                          }`}
                        />
                        {!reached && (
                          <div className="absolute top-2 right-2 h-9 w-9 rounded-full bg-muted/90 backdrop-blur flex items-center justify-center border border-border">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        {reached && (
                          <div className="absolute -top-1 -right-1 h-9 w-9 rounded-full bg-primary flex items-center justify-center shadow-lg">
                            <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      <h2 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight">{tier.name}</h2>
                      <p className="text-sm text-muted-foreground mt-1">Meta: <strong className="text-foreground">{tier.label}</strong></p>

                      {reached ? (
                        <div className="mt-4 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 w-full">
                          <p className="text-base font-bold text-primary">Parabéns pela conquista!</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Você desbloqueou a placa {tier.name} ao atingir {tier.label} em faturamento.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 px-4 py-3 rounded-xl bg-muted/40 border border-border w-full">
                          <p className="text-base font-bold text-foreground">Ainda não conquistada</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Faltam <strong className="text-foreground">{fmtBRL(Math.max(0, tier.threshold - revenue))}</strong> para desbloquear esta placa.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        </Suspense>
      )}
    </>
  );
}
