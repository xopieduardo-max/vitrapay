import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StickyNote, Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  ticketId: string | null;
}

export function InternalNotesSheet({ ticketId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["ticket-notes", ticketId],
    enabled: !!ticketId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_notes")
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: admins = {} } = useQuery({
    queryKey: ["ticket-notes-admins", notes.map((n: any) => n.admin_id).join(",")],
    enabled: notes.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(notes.map((n: any) => n.admin_id))) as string[];
      const { data } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p; });
      return map;
    },
  });

  useEffect(() => { setEditId(null); setEditBody(""); }, [ticketId]);

  async function add() {
    if (!body.trim() || !ticketId || !user) return;
    setSaving(true);
    const { error } = await supabase.from("support_ticket_notes").insert({
      ticket_id: ticketId,
      admin_id: user.id,
      content: body.trim(),
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar nota"); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["ticket-notes", ticketId] });
  }

  async function saveEdit(id: string) {
    if (!editBody.trim()) return;
    const { error } = await supabase
      .from("support_ticket_notes")
      .update({ content: editBody.trim() })
      .eq("id", id);
    if (error) { toast.error("Erro ao editar"); return; }
    setEditId(null);
    setEditBody("");
    qc.invalidateQueries({ queryKey: ["ticket-notes", ticketId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("support_ticket_notes").delete().eq("id", id);
    if (error) { toast.error("Erro ao apagar"); return; }
    qc.invalidateQueries({ queryKey: ["ticket-notes", ticketId] });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 relative" disabled={!ticketId}>
          <StickyNote className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Notas</span>
          {notes.length > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[0.6rem]">{notes.length}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-yellow-500" />
            Notas internas
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Privadas — apenas administradores veem. O cliente nunca terá acesso.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma nota ainda.</p>
          ) : (
            notes.map((n: any) => {
              const author = admins[n.admin_id];
              const mine = n.admin_id === user?.id;
              const isEditing = editId === n.id;
              return (
                <div key={n.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <p className="text-xs font-semibold truncate">{author?.display_name || "Admin"}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[0.65rem] text-muted-foreground">
                        {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                      {mine && !isEditing && (
                        <>
                          <button onClick={() => { setEditId(n.id); setEditBody(n.content); }} className="p-1 hover:bg-muted rounded" aria-label="Editar">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => remove(n.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" aria-label="Apagar">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} className="text-sm" />
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-3 w-3" /></Button>
                        <Button size="sm" onClick={() => saveEdit(n.id)}><Check className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-foreground/90">{n.content}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t pt-3 space-y-2">
          <Textarea
            placeholder="Escreva uma nota interna…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] text-muted-foreground">⌘/Ctrl + Enter para salvar</p>
            <Button size="sm" onClick={add} disabled={saving || !body.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
