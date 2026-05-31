import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, Share2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { TIERS } from "@/components/MilestoneTracker";
import { shareAchievement, playUnlockSound, isSoundEnabled, toggleSound } from "@/lib/achievementShare";

const EMOJIS = ["🎉", "🚀", "💰", "⭐", "🔥", "✨", "🏆", "💎"];
const PARTICLE_COUNT = 28;

// Respeita prefers-reduced-motion globalmente
const prefersReducedMotion = typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface Props {
  revenue: number; // em centavos
  previewTier?: string | null;
}

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function MilestoneCelebration({ revenue, previewTier: previewTierProp }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: requested = [] } = useQuery({
    queryKey: ["award-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("award_requests")
        .select("milestone")
        .eq("user_id", user!.id);
      return (data || []).map((r: any) => Number(r.milestone));
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-for-award", user?.id],
    enabled: !!user && !!activeMilestone,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Preview mode via ?previewTier=Start|Bronze|... or via prop
  const urlPreviewTier = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("previewTier");
  }, []);

  const previewTierName = previewTierProp ?? urlPreviewTier;

  // Maior tier atingido ainda não solicitado
  const pendingTier = useMemo(() => {
    if (previewTierName) {
      return TIERS.find((t) => t.name.toLowerCase() === previewTierName.toLowerCase()) ?? null;
    }
    const sorted = [...TIERS].sort((a, b) => b.threshold - a.threshold);
    return sorted.find((t) => revenue >= t.threshold && !requested.includes(t.threshold)) ?? null;
  }, [revenue, requested, previewTierName]);

  useEffect(() => {
    if (activeMilestone !== null) return;
    if (!pendingTier) return;
    if (previewTierName) {
      setActiveMilestone(pendingTier.threshold);
      return;
    }
    if (!user) return;
    const key = `award_dismissed_${user.id}_${pendingTier.threshold}`;
    if (sessionStorage.getItem(key)) return;
    setActiveMilestone(pendingTier.threshold);
  }, [pendingTier, user, activeMilestone, previewTierName]);

  // Toca o som quando o modal abre
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  useEffect(() => {
    if (activeMilestone && !showForm) playUnlockSound();
  }, [activeMilestone, showForm]);

  const [sharing, setSharing] = useState(false);
  const handleShare = async () => {
    if (!activeTier) return;
    setSharing(true);
    try {
      const r = await shareAchievement({
        tierName: activeTier.name,
        tierLabel: activeTier.label,
        badgeSrc: activeTier.image,
        userName: profile?.display_name,
      });
      toast.success(r === "shared" ? "Compartilhado!" : "Imagem baixada — pronto para postar.");
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setSharing(false);
    }
  };


  const activeTier = useMemo(
    () => TIERS.find((t) => t.threshold === activeMilestone) || null,
    [activeMilestone]
  );

  const [form, setForm] = useState({
    shipping_name: "", shipping_phone: "", shipping_cep: "",
    shipping_street: "", shipping_number: "", shipping_complement: "",
    shipping_neighborhood: "", shipping_city: "", shipping_state: "",
  });

  useEffect(() => {
    if (profile && showForm) {
      setForm({
        shipping_name: profile.display_name || "",
        shipping_phone: profile.phone || "",
        shipping_cep: profile.address_cep || "",
        shipping_street: profile.address_street || "",
        shipping_number: profile.address_number || "",
        shipping_complement: profile.address_complement || "",
        shipping_neighborhood: profile.address_neighborhood || "",
        shipping_city: profile.address_city || "",
        shipping_state: profile.address_state || "",
      });
    }
  }, [profile, showForm]);

  const closeAll = () => {
    if (user && activeMilestone) {
      sessionStorage.setItem(`award_dismissed_${user.id}_${activeMilestone}`, "1");
    }
    setActiveMilestone(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!user || !activeMilestone) return;
    const required = ["shipping_name", "shipping_phone", "shipping_cep", "shipping_street", "shipping_number", "shipping_neighborhood", "shipping_city", "shipping_state"] as const;
    for (const f of required) {
      if (!form[f].trim()) {
        toast.error("Preencha todos os campos obrigatórios.");
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from("award_requests").insert({
      user_id: user.id,
      milestone: activeMilestone,
      status: "pending",
      ...form,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível registrar sua solicitação.");
      return;
    }
    toast.success("Solicitação enviada! Em breve sua placa será preparada.");
    qc.invalidateQueries({ queryKey: ["award-requests", user.id] });
    setActiveMilestone(null);
    setShowForm(false);
  };

  if (!activeTier) return null;

  return (
    <>
      {/* ── Confetti background ── */}
      <AnimatePresence>
        {activeTier && !showForm && !prefersReducedMotion && (
          <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = 2.0 + Math.random() * 1.5;
              const duration = 2.8 + Math.random() * 1.5;
              const emoji = EMOJIS[i % EMOJIS.length];
              const size = 16 + Math.random() * 18;
              const rotation = Math.random() * 720 - 360;
              return (
                <motion.div
                  key={i}
                  initial={{ y: -40, x: `${left}vw`, opacity: 1, rotate: 0, scale: 0 }}
                  animate={{ y: "110vh", opacity: [1, 1, 0.8, 0], rotate: rotation, scale: [0, 1.2, 1, 0.8] }}
                  transition={{ duration, delay, ease: "easeIn" }}
                  className="absolute"
                  style={{ fontSize: size, left: 0, top: 0 }}
                >
                  {emoji}
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* ── Cinematic unlock modal ── */}
      <Dialog open={!!activeTier && !showForm} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="sm:max-w-md overflow-hidden border-primary/30">
          {/* Radial glow background */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-80"
            style={{
              background: `radial-gradient(circle at 50% 28%, ${activeTier.glow}, transparent 60%)`,
            }}
          />

          <DialogHeader className="sr-only">
            <DialogTitle>Conquista desbloqueada: {activeTier.name}</DialogTitle>
          </DialogHeader>

          <div className="relative flex flex-col items-center text-center pt-2 pb-1">
            {/* Tiny "novo nível" pill */}
            <div className="title-rise inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-primary mb-4">
              <Sparkles className="h-3 w-3" />
              Novo brasão desbloqueado
            </div>

            {/* Badge with unlock sequence */}
            <div className="relative h-44 w-44 md:h-52 md:w-52 flex items-center justify-center mb-2">
              {/* Burst ring */}
              <div className="badge-burst-ring" style={{ borderColor: "hsl(var(--primary))" }} />
              <div
                className="absolute inset-2 rounded-full blur-2xl"
                style={{ background: activeTier.glow, opacity: 0.7 }}
              />

              {/* Badge image */}
              <div className="relative h-full w-full flex items-center justify-center">
                <img
                  src={activeTier.image}
                  alt={activeTier.name}
                  className="badge-unlock-anim h-40 w-40 md:h-48 md:w-48 object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.55)]"
                  decoding="async"
                />
                {/* Light sweep overlay */}
                <div className="badge-light-sweep" aria-hidden />
              </div>
            </div>

            <h2 className="title-rise-late text-2xl md:text-3xl font-extrabold tracking-tight">
              {activeTier.name}
            </h2>
            <p className="title-rise-late text-sm text-muted-foreground mt-1">
              Você atingiu <span className="text-primary font-bold">{fmt(activeTier.threshold)}</span> em faturamento
            </p>

            <div className="title-rise-cta mt-6 w-full flex flex-col sm:flex-row gap-2 sm:justify-center">
              <Button variant="ghost" size="icon" onClick={() => { const v = !soundOn; setSoundOn(v); toggleSound(v); }} title={soundOn ? "Som ligado" : "Som desligado"}>
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={handleShare} disabled={sharing} className="gap-1.5">
                {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Compartilhar
              </Button>
              <Button variant="outline" onClick={closeAll}>Mais tarde</Button>
              <Button
                onClick={() => setShowForm(true)}
                className="shadow-[0_0_24px_hsl(var(--primary)/0.45)]"
              >
                Solicitar minha placa
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* ── Shipping form ── */}
      <Dialog open={showForm} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <img src={activeTier.image} alt="" className="h-10 w-10 object-contain" decoding="async" />
              <div>
                <p className="text-base font-bold">Placa {activeTier.name} — {fmt(activeTier.threshold)}</p>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">Dados para envio</p>
              </div>
            </DialogTitle>
            <DialogDescription className="pt-2">
              Confira ou complete o endereço onde sua placa de premiação será entregue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Nome completo *</Label>
              <Input value={form.shipping_name} onChange={(e) => setForm({ ...form, shipping_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone *</Label>
              <Input value={form.shipping_phone} onChange={(e) => setForm({ ...form, shipping_phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CEP *</Label>
              <Input value={form.shipping_cep} onChange={(e) => setForm({ ...form, shipping_cep: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Rua / Logradouro *</Label>
              <Input value={form.shipping_street} onChange={(e) => setForm({ ...form, shipping_street: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número *</Label>
              <Input value={form.shipping_number} onChange={(e) => setForm({ ...form, shipping_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Complemento</Label>
              <Input value={form.shipping_complement} onChange={(e) => setForm({ ...form, shipping_complement: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Bairro *</Label>
              <Input value={form.shipping_neighborhood} onChange={(e) => setForm({ ...form, shipping_neighborhood: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cidade *</Label>
              <Input value={form.shipping_city} onChange={(e) => setForm({ ...form, shipping_city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado (UF) *</Label>
              <Input maxLength={2} value={form.shipping_state} onChange={(e) => setForm({ ...form, shipping_state: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Voltar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
