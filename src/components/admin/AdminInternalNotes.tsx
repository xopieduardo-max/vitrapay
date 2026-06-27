import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, StickyNote, Pin, PinOff, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  userId: string;
}

interface NoteRow {
  id: string;
  target_user_id: string;
  author_id: string;
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export function AdminInternalNotes({ userId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["admin-notes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notes" as any)
        .select("*")
        .eq("target_user_id", userId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as NoteRow[];
    },
  });

  // Map author IDs to display names
  const authorIds = Array.from(new Set(notes.map((n) => n.author_id)));
  const { data: authors = {} } = useQuery({
    queryKey: ["admin-notes-authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", authorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = p.display_name || "Admin";
      });
      return map;
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const txt = draft.trim();
      if (!txt) throw new Error("Nota vazia");
      const { error } = await supabase.from("admin_notes" as any).insert({
        target_user_id: userId,
        author_id: user.id,
        content: txt,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["admin-notes", userId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar nota"),
  });

  const togglePin = useMutation({
    mutationFn: async (note: NoteRow) => {
      const { error } = await supabase
        .from("admin_notes" as any)
        .update({ pinned: !note.pinned } as any)
        .eq("id", note.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notes", userId] }),
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("admin_notes" as any).delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notes", userId] });
      toast.success("Nota removida");
    },
  });

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4" strokeWidth={1.5} />
          Notas internas
          <Badge variant="outline" className="text-[0.6rem] uppercase tracking-wider">
            Só admins
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva uma observação sobre este usuário (visível só para admins)..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => addNote.mutate()}
              disabled={addNote.isPending || !draft.trim()}
            >
              {addNote.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Adicionar nota
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
            </div>
          )}
          {!isLoading && notes.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">
              Nenhuma nota ainda.
            </p>
          )}
          {notes.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${
                n.pinned ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  {authors[n.author_id] || "Admin"} •{" "}
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => togglePin.mutate(n)}
                    title={n.pinned ? "Desafixar" : "Fixar"}
                  >
                    {n.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Remover esta nota?")) deleteNote.mutate(n.id);
                    }}
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-foreground">{n.content}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
