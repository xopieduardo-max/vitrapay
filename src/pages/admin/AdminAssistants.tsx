import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserPlus, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { convertImageToWebp } from "@/lib/toWebp";
import { useAssistantAvatars } from "@/hooks/useAssistantAvatars";

interface Assistant {
  id: string;
  name: string;
  role_label: string | null;
  avatar_url: string | null;
  active: boolean;
  sort_order: number;
}

const initials = (s: string) =>
  s.trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");

export default function AdminAssistants() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Assistant> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: assistants = [], isLoading } = useQuery({
    queryKey: ["admin-assistants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_assistants")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Assistant[];
    },
  });

  const avatarUrls = useAssistantAvatars(assistants.map((a) => a.avatar_url));

  const openNew = () => {
    setEditing({ name: "", role_label: "Atendente VitraPay", active: true, sort_order: assistants.length });
    setFile(null);
  };

  const save = async () => {
    if (!editing?.name?.trim()) {
      toast.error("Informe o nome do atendente.");
      return;
    }
    setSaving(true);
    let avatar_url = editing.avatar_url ?? null;

    if (file) {
      const webp = file.type.startsWith("image/") ? await convertImageToWebp(file) : file;
      const ext = (webp.name.split(".").pop() || "webp").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("support-assistants")
        .upload(path, webp, { contentType: webp.type, upsert: false });
      if (upErr) {
        setSaving(false);
        toast.error("Falha ao enviar foto.");
        return;
      }
      avatar_url = path;
    }

    const payload = {
      name: editing.name.trim(),
      role_label: editing.role_label?.trim() || null,
      avatar_url,
      active: editing.active ?? true,
      sort_order: editing.sort_order ?? 0,
    };

    let error;
    if (editing.id) {
      ({ error } = await supabase.from("support_assistants").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("support_assistants").insert({ ...payload, created_by: user!.id }));
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar.");
      return;
    }
    toast.success(editing.id ? "Atendente atualizado" : "Atendente criado");
    setEditing(null);
    setFile(null);
    qc.invalidateQueries({ queryKey: ["admin-assistants"] });
    qc.invalidateQueries({ queryKey: ["active-assistants"] });
  };

  const toggleActive = async (a: Assistant) => {
    await supabase.from("support_assistants").update({ active: !a.active }).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["admin-assistants"] });
    qc.invalidateQueries({ queryKey: ["active-assistants"] });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const a = assistants.find((x) => x.id === deleting);
    setDeleting(null);
    if (a?.avatar_url && !/^https?:\/\//.test(a.avatar_url)) {
      supabase.storage.from("support-assistants").remove([a.avatar_url]).catch(() => {});
    }
    const { error } = await supabase.from("support_assistants").delete().eq("id", a!.id);
    if (error) { toast.error("Erro ao apagar."); return; }
    toast.success("Atendente removido");
    qc.invalidateQueries({ queryKey: ["admin-assistants"] });
    qc.invalidateQueries({ queryKey: ["active-assistants"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atendentes do Suporte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie perfis (nome + foto) para personalizar quem responde os chamados.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <UserPlus className="h-4 w-4" /> Novo atendente
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : assistants.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Nenhum atendente cadastrado. Crie o primeiro para começar a humanizar suas respostas.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {assistants.map((a) => (
            <Card key={a.id} className="p-4 flex items-center gap-3">
              <Avatar className="h-14 w-14 shrink-0">
                {a.avatar_url && <AvatarImage src={avatarUrls[a.avatar_url] || ""} alt={a.name} />}
                <AvatarFallback className="bg-primary/15 text-primary font-semibold">{initials(a.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground truncate">{a.role_label || "Atendente"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Switch checked={a.active} onCheckedChange={() => toggleActive(a)} />
                  <span className="text-xs text-muted-foreground">{a.active ? "Ativo" : "Inativo"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setFile(null); }} className="h-8 w-8">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleting(a.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && (setEditing(null), setFile(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar atendente" : "Novo atendente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {file ? (
                  <AvatarImage src={URL.createObjectURL(file)} alt="preview" />
                ) : editing?.avatar_url ? (
                  <AvatarImage src={avatarUrls[editing.avatar_url] || ""} alt={editing.name || ""} />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
                  {initials(editing?.name || "?")}
                </AvatarFallback>
              </Avatar>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-primary hover:underline">
                <Upload className="h-4 w-4" /> Escolher foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editing?.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex: Maria"
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo / Etiqueta</Label>
              <Input
                value={editing?.role_label || ""}
                onChange={(e) => setEditing({ ...editing, role_label: e.target.value })}
                placeholder="Ex: Atendente VitraPay"
                maxLength={60}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing?.active ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, active: v })}
              />
              <span className="text-sm">Ativo</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditing(null); setFile(null); }}>Cancelar</Button>
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
            <AlertDialogTitle>Remover atendente?</AlertDialogTitle>
            <AlertDialogDescription>
              As mensagens já enviadas continuam visíveis, mas perdem o vínculo com o atendente.
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
