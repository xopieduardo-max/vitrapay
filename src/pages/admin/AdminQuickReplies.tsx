import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Loader2, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  body: string;
  active: boolean;
  sort_order: number;
}

export default function AdminQuickReplies() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<QuickReply> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-quick-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_quick_replies")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as QuickReply[];
    },
  });

  const openNew = () =>
    setEditing({ title: "", shortcut: "", body: "", active: true, sort_order: items.length });

  const save = async () => {
    if (!editing?.title?.trim() || !editing?.body?.trim()) {
      toast.error("Informe o título e a mensagem.");
      return;
    }
    setSaving(true);
    const payload = {
      title: editing.title.trim(),
      shortcut: editing.shortcut?.trim() || null,
      body: editing.body,
      active: editing.active ?? true,
      sort_order: editing.sort_order ?? 0,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("support_quick_replies").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("support_quick_replies").insert({ ...payload, created_by: user!.id }));
    }
    setSaving(false);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success(editing.id ? "Resposta atualizada" : "Resposta criada");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-quick-replies"] });
    qc.invalidateQueries({ queryKey: ["active-quick-replies"] });
  };

  const toggleActive = async (q: QuickReply) => {
    await supabase.from("support_quick_replies").update({ active: !q.active }).eq("id", q.id);
    qc.invalidateQueries({ queryKey: ["admin-quick-replies"] });
    qc.invalidateQueries({ queryKey: ["active-quick-replies"] });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting;
    setDeleting(null);
    const { error } = await supabase.from("support_quick_replies").delete().eq("id", id);
    if (error) { toast.error("Erro ao apagar."); return; }
    toast.success("Resposta removida");
    qc.invalidateQueries({ queryKey: ["admin-quick-replies"] });
    qc.invalidateQueries({ queryKey: ["active-quick-replies"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Respostas Rápidas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie modelos de mensagens. No chat, digite <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">/</kbd> para abrir a lista e inserir.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nova resposta
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Nenhuma resposta cadastrada. Crie sua primeira macro para responder mais rápido.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((q) => (
            <Card key={q.id} className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Zap className={`h-4 w-4 mt-0.5 shrink-0 ${q.active ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{q.title}</p>
                    {q.shortcut && (
                      <code className="text-[0.65rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        /{q.shortcut}
                      </code>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{q.body}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(q)} className="h-7 w-7">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleting(q.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Switch checked={q.active} onCheckedChange={() => toggleActive(q)} />
                <span className="text-xs text-muted-foreground">{q.active ? "Ativa" : "Inativa"}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar resposta rápida" : "Nova resposta rápida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editing?.title || ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Ex: Aguardando verificação"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label>Atalho (opcional)</Label>
              <Input
                value={editing?.shortcut || ""}
                onChange={(e) => setEditing({ ...editing, shortcut: e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase() })}
                placeholder="ex: aguarde"
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground">No chat, digitar <code>/{editing?.shortcut || "atalho"}</code> filtra esta resposta.</p>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={editing?.body || ""}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                placeholder="Texto que será inserido no chat..."
                rows={6}
                className="resize-none"
                lang="pt-BR"
                spellCheck
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing?.active ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, active: v })}
              />
              <span className="text-sm">Ativa</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover resposta rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As mensagens já enviadas continuam intactas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
