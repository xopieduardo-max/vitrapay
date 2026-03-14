import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, Image, GripVertical } from "lucide-react";

export default function AdminBanners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newLink, setNewLink] = useState("");

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_banners")
        .select("*")
        .order("position", { ascending: true });
      return data || [];
    },
  });

  const addBanner = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error("Título obrigatório");
      const { error } = await supabase.from("platform_banners").insert({
        title: newTitle.trim(),
        image_url: newImage.trim() || null,
        link_url: newLink.trim() || null,
        position: banners.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Banner criado!" });
      setNewTitle("");
      setNewImage("");
      setNewLink("");
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleBanner = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("platform_banners").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-banners"] }),
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Banner removido" });
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Banners da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Banners exibidos no dashboard dos produtores
        </p>
      </div>

      {/* Add new */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Novo Banner</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Black Friday 🔥" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL da Imagem</Label>
            <Input value={newImage} onChange={(e) => setNewImage(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link (opcional)</Label>
            <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => addBanner.mutate()} disabled={addBanner.isPending}>
          <Plus className="h-3.5 w-3.5" /> Adicionar Banner
        </Button>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Banners ativos ({banners.filter((b: any) => b.is_active).length})</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum banner criado.</div>
        ) : (
          banners.map((b: any, i: number) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
              {b.image_url ? (
                <img src={b.image_url} alt="" className="h-10 w-16 rounded object-cover shrink-0" />
              ) : (
                <div className="h-10 w-16 rounded bg-muted flex items-center justify-center shrink-0">
                  <Image className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.title}</p>
                {b.link_url && <p className="text-xs text-muted-foreground truncate">{b.link_url}</p>}
              </div>
              <Switch
                checked={b.is_active}
                onCheckedChange={(v) => toggleBanner.mutate({ id: b.id, is_active: v })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deleteBanner.mutate(b.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
