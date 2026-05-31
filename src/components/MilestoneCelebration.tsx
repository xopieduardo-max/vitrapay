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
import { Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const EMOJIS = ["🎉", "🚀", "💰", "⭐", "🔥", "✨", "🏆", "💎"];
const PARTICLE_COUNT = 24;

interface Props {
  revenue: number; // em centavos
  milestones: number[]; // em centavos
}

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function MilestoneCelebration({ revenue, milestones }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Solicitações já feitas
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

  // Marco mais alto atingido ainda não solicitado
  const pendingMilestone = useMemo(() => {
    const sorted = [...milestones].sort((a, b) => b - a);
    return sorted.find((m) => revenue >= m && !requested.includes(m)) ?? null;
  }, [milestones, revenue, requested]);

  useEffect(() => {
    if (!user || activeMilestone !== null) return;
    if (pendingMilestone === null) return;
    const dismissedKey = `award_dismissed_${user.id}_${pendingMilestone}`;
    if (sessionStorage.getItem(dismissedKey)) return;
    setActiveMilestone(pendingMilestone);
  }, [pendingMilestone, user, activeMilestone]);

  // Form state
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

  if (!activeMilestone) return null;

  return (
    <>
      {/* Confetti + banner inicial */}
      <AnimatePresence>
        {activeMilestone && !showForm && (
          <>
            <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
              {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
                const left = Math.random() * 100;
                const delay = Math.random() * 0.8;
                const duration = 2.5 + Math.random() * 1.5;
                const emoji = EMOJIS[i % EMOJIS.length];
                const size = 16 + Math.random() * 16;
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
          </>
        )}
      </AnimatePresence>

      {/* Modal de celebração */}
      <Dialog open={!!activeMilestone && !showForm} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="space-y-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.5 }}
              className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center"
            >
              <Trophy className="h-8 w-8 text-primary" strokeWidth={1.8} />
            </motion.div>
            <DialogTitle className="text-2xl">Parabéns! Meta atingida</DialogTitle>
            <DialogDescription className="text-base">
              Você ultrapassou <span className="text-primary font-bold">{fmt(activeMilestone)}</span> em faturamento.
              Solicite agora sua placa de premiação VitraPay.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-center pt-2">
            <Button variant="outline" onClick={closeAll}>Mais tarde</Button>
            <Button onClick={() => setShowForm(true)}>Solicitar minha placa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formulário de envio */}
      <Dialog open={showForm} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados para envio da placa — {fmt(activeMilestone)}</DialogTitle>
            <DialogDescription>
              Confira ou complete o endereço onde a placa será entregue.
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
