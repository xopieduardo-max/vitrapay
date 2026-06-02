import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { TIERS } from "@/components/MilestoneTracker";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface TierForm {
  title: string;
  description: string;
  image_url: string;
  rewards: string;
}

const emptyForm: TierForm = { title: "", description: "", image_url: "", rewards: "" };

export function AdminAwardTiersEditor({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [activeTier, setActiveTier] = useState<string>(TIERS[0].name);
  const [form, setForm] = useState<TierForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: customizations, isLoading } = useQuery({
    queryKey: ["award-tier-customizations-admin"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("award_tier_customizations").select("*");
      const map: Record<string, any> = {};
      (data || []).forEach((c: any) => { map[c.tier_name] = c; });
      return map;
    },
  });

  useEffect(() => {
    const c = customizations?.[activeTier];
    setForm({
      title: c?.title || "",
      description: c?.description || "",
      image_url: c?.image_url || "",
      rewards: Array.isArray(c?.rewards) ? c.rewards.join("\n") : "",
    });
  }, [activeTier, customizations]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${activeTier.toLowerCase()}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("award-tier-images")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("award-tier-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Imagem carregada.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const rewards = form.rewards
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("award_tier_customizations")
      .upsert({
        tier_name: activeTier,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        rewards,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      }, { onConflict: "tier_name" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar.");
      return;
    }
    toast.success(`Conquista ${activeTier} atualizada.`);
    qc.invalidateQueries({ queryKey: ["award-tier-customizations-admin"] });
    qc.invalidateQueries({ queryKey: ["award-tier-customizations"] });
  };

  const tier = TIERS.find((t) => t.name === activeTier)!;
  const preview = form.image_url || tier.image;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customizar conquistas do Programa de Benefícios</DialogTitle>
          <DialogDescription>
            Atualize imagem, título, descrição e recompensas que aparecem para os produtores em cada nível.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid md:grid-cols-[160px_1fr] gap-4 flex-1 min-h-0">
            {/* Lista de tiers */}
            <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 md:pr-1">
              {TIERS.map((t) => {
                const active = t.name === activeTier;
                return (
                  <button
                    key={t.name}
                    onClick={() => setActiveTier(t.name)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all shrink-0 md:shrink ${
                      active
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <img src={t.image} alt="" className="h-6 w-6 object-contain" />
                    <div className="min-w-0">
                      <p className="font-bold leading-tight">{t.name}</p>
                      <p className="text-[10px] opacity-70 leading-tight">{t.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Formulário */}
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-[100px_1fr] gap-3 items-start">
                <div className="aspect-square rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                  <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Imagem</Label>
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                      />
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary/40 transition-colors">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Enviar imagem
                      </span>
                    </label>
                    {form.image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Ou cole uma URL de imagem"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={`Conquista ${tier.name}`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Descrição</Label>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={`Atinja ${tier.label} em faturamento e desbloqueie a placa ${tier.name}.`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Recompensas (uma por linha)
                </Label>
                <Textarea
                  rows={5}
                  value={form.rewards}
                  onChange={(e) => setForm({ ...form, rewards: e.target.value })}
                  placeholder={"Placa de Faturamento personalizada\nMacallan 12 Anos\nCharuto Don Emanuel"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background/95 backdrop-blur py-2 -mx-1 px-1">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar {tier.name}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
