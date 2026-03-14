import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, MessageSquareMore } from "lucide-react";

export default function AdminPopups() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newButtonText, setNewButtonText] = useState("Entendi");
  const [newButtonUrl, setNewButtonUrl] = useState("");
  const [showOnce, setShowOnce] = useState(true);

  const { data: popups = [], isLoading } = useQuery({
    queryKey: ["admin-popups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_popups")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addPopup = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error("Título obrigatório");
      const { error } = await supabase.from("platform_popups").insert({
        title: newTitle.trim(),
        content: newContent.trim() || null,
        image_url: newImage.trim() || null,
        button_text: newButtonText.trim() || "Entendi",
        button_url: newButtonUrl.trim() || null,
        show_once: showOnce,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pop-up criado!" });
      setNewTitle("");
      setNewContent("");
      setNewImage("");
      setNewButtonText("Entendi");
      setNewButtonUrl("");
      queryClient.invalidateQueries({ queryKey: ["admin-popups"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const togglePopup = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("platform_popups").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-popups"] }),
  });

  const deletePopup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_popups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pop-up removido" });
      queryClient.invalidateQueries({ queryKey: ["admin-popups"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pop-ups da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comunicados e informativos exibidos aos usuários
        </p>
      </div>

      {/* Add new */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Novo Pop-up</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="🎉 Novidade na plataforma!" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL da Imagem (opcional)</Label>
            <Input value={newImage} onChange={(e) => setNewImage(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Conteúdo</Label>
          <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Escreva o comunicado..." rows={3} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Texto do botão</Label>
            <Input value={newButtonText} onChange={(e) => setNewButtonText(e.target.value)} placeholder="Entendi" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link do botão (opcional)</Label>
            <Input value={newButtonUrl} onChange={(e) => setNewButtonUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch checked={showOnce} onCheckedChange={setShowOnce} />
            <Label className="text-xs">Mostrar apenas uma vez</Label>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => addPopup.mutate()} disabled={addPopup.isPending}>
          <Plus className="h-3.5 w-3.5" /> Criar Pop-up
        </Button>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Pop-ups ({popups.length})</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : popups.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pop-up criado.</div>
        ) : (
          popups.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <MessageSquareMore className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground truncate">{p.content || "Sem conteúdo"}</p>
              </div>
              <span className="text-[0.6rem] text-muted-foreground shrink-0">
                {p.show_once ? "1x" : "Sempre"}
              </span>
              <Switch
                checked={p.is_active}
                onCheckedChange={(v) => togglePopup.mutate({ id: p.id, is_active: v })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deletePopup.mutate(p.id)}
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
