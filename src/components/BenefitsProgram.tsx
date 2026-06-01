import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TIERS, getTierIndex } from "@/components/MilestoneTracker";

const fmtBRL = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface Customization {
  tier_name: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  rewards: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  revenue: number;
  initialTier?: string | null;
}

export function BenefitsProgram({ open, onOpenChange, revenue, initialTier }: Props) {
  const currentIdx = getTierIndex(revenue);

  const { data: customizations = {} } = useQuery({
    queryKey: ["award-tier-customizations"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("award_tier_customizations").select("*");
      const map: Record<string, Customization> = {};
      (data || []).forEach((c: any) => {
        map[c.tier_name] = {
          ...c,
          rewards: Array.isArray(c.rewards) ? c.rewards : [],
        };
      });
      return map;
    },
  });

  const [idx, setIdx] = useState(0);

  // Quando abrir, foca no tier inicial (ou no atual / próximo bloqueado)
  useEffect(() => {
    if (!open) return;
    if (initialTier) {
      const i = TIERS.findIndex((t) => t.name.toLowerCase() === initialTier.toLowerCase());
      if (i >= 0) {
        setIdx(i);
        return;
      }
    }
    const next = currentIdx + 1;
    setIdx(Math.max(0, Math.min(TIERS.length - 1, next < TIERS.length ? next : currentIdx)));
  }, [open, initialTier, currentIdx]);

  const tier = TIERS[idx];
  const custom = customizations[tier.name];
  const reached = idx <= currentIdx;
  const prevThreshold = idx > 0 ? TIERS[idx - 1].threshold : 0;
  const progressPct = useMemo(() => {
    const span = tier.threshold - prevThreshold;
    if (span <= 0) return 100;
    return Math.min(100, Math.max(0, ((revenue - prevThreshold) / span) * 100));
  }, [revenue, tier.threshold, prevThreshold]);

  const image = custom?.image_url || tier.image;
  const title = custom?.title || `Conquista ${tier.name}`;
  const description = custom?.description ||
    `Atinja ${tier.label} em faturamento e desbloqueie a placa ${tier.name}.`;
  const rewards = custom?.rewards?.length ? custom.rewards : ["Placa de Faturamento personalizada"];

  const canPrev = idx > 0;
  const canNext = idx < TIERS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden border-border bg-card">
        <DialogHeader className="px-6 pt-6 pb-3 text-center space-y-1">
          <DialogTitle className="text-xl font-bold tracking-tight">Programa de Benefícios</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Acompanhe seu progresso e conquiste recompensas exclusivas
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div className="grid md:grid-cols-2 gap-5 md:gap-6">
            {/* Imagem grande */}
            <div
              className="relative aspect-square rounded-2xl overflow-hidden border border-border bg-black flex items-center justify-center"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${tier.glow}, transparent 65%), #0a0a0a`,
              }}
            >
              <img
                src={image}
                alt={title}
                className={`max-h-full max-w-full object-contain transition-all duration-500 ${
                  reached ? "" : "opacity-90"
                }`}
                decoding="async"
              />
            </div>

            {/* Conteúdo */}
            <div className="flex flex-col">
              <Badge
                variant="outline"
                className={`self-start mb-3 gap-1 ${
                  reached
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/40 text-muted-foreground border-border"
                }`}
              >
                {reached ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {reached ? "Desbloqueado" : "Bloqueado"}
              </Badge>

              <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>

              <div className="mt-5">
                <p className="text-sm font-semibold mb-2">Recompensas</p>
                <ul className="space-y-1.5">
                  {rewards.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-2 h-1 w-1 rounded-full bg-muted-foreground/70 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="text-muted-foreground">{fmtBRL(prevThreshold)}</span>
              <span className="text-muted-foreground">{fmtBRL(tier.threshold)}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`,
                }}
              />
            </div>

            <div
              className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold ${
                reached
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              {reached ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Conquista desbloqueada
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Atinja {fmtBRL(tier.threshold)} para resgatar
                </>
              )}
            </div>
          </div>

          {/* Navegação */}
          <div className="mt-5 grid grid-cols-3 items-center">
            <button
              type="button"
              onClick={() => canPrev && setIdx(idx - 1)}
              disabled={!canPrev}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors justify-self-start"
            >
              <ChevronLeft className="h-4 w-4" />
              Recompensa anterior
            </button>

            <div className="flex items-center gap-1.5 justify-self-center">
              {TIERS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Ir para ${TIERS[i].name}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => canNext && setIdx(idx + 1)}
              disabled={!canNext}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors justify-self-end"
            >
              Próxima recompensa
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
