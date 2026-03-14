import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, XCircle, Lightbulb, Clock, ThumbsUp, Trash2, Loader2,
} from "lucide-react";

export default function AdminCommunity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["admin-community-suggestions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["community-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return data || [];
    },
  });

  const getDisplayName = (userId: string) => {
    const p = profiles.find((pr: any) => pr.user_id === userId);
    return p?.display_name || "Usuário";
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("community_suggestions")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast({ title: status === "approved" ? "Sugestão aprovada!" : "Sugestão rejeitada" });
      queryClient.invalidateQueries({ queryKey: ["admin-community-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_suggestions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sugestão removida" });
      queryClient.invalidateQueries({ queryKey: ["admin-community-suggestions"] });
    },
  });

  const pending = suggestions.filter((s: any) => s.status === "pending");
  const approved = suggestions.filter((s: any) => s.status === "approved");
  const rejected = suggestions.filter((s: any) => s.status === "rejected");

  const statusConfig = {
    pending: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/20", icon: Clock },
    approved: { label: "Aprovada", className: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle2 },
    rejected: { label: "Rejeitada", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  };

  const renderList = (items: any[], showActions: boolean) => (
    items.length === 0 ? (
      <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma sugestão.</p>
    ) : (
      items.map((s: any, i: number) => {
        const sc = statusConfig[s.status as keyof typeof statusConfig];
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
          >
            <div className="flex flex-col items-center gap-0.5 pt-1 text-muted-foreground">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-xs font-bold">{s.votes_count}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <Badge variant="outline" className={`text-[0.6rem] ${sc.className}`}>
                  <sc.icon className="h-2.5 w-2.5 mr-1" />
                  {sc.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
              <div className="flex items-center gap-2 mt-2 text-[0.6rem] text-muted-foreground">
                <span>{getDisplayName(s.user_id)}</span>
                <span>•</span>
                <span>{format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {showActions && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                    onClick={() => updateStatus.mutate({ id: s.id, status: "approved" })}
                    title="Aprovar"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => updateStatus.mutate({ id: s.id, status: "rejected" })}
                    title="Rejeitar"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deleteSuggestion.mutate(s.id)}
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        );
      })
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comunidade</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sugestões e ideias dos usuários</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Pending */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-warning" />
              <h2 className="text-sm font-semibold">Aguardando aprovação ({pending.length})</h2>
            </div>
            {renderList(pending, true)}
          </div>

          {/* Approved */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-sm font-semibold">Aprovadas ({approved.length})</h2>
            </div>
            {renderList(approved, false)}
          </div>

          {/* Rejected */}
          {rejected.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                <h2 className="text-sm font-semibold">Rejeitadas ({rejected.length})</h2>
              </div>
              {renderList(rejected, false)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
