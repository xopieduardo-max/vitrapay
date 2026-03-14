import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Lightbulb, ThumbsUp, MessageCircle, Plus, Send, Loader2, Clock, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Fetch approved suggestions
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["community-suggestions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_suggestions")
        .select("*")
        .order("votes_count", { ascending: false });
      return data || [];
    },
  });

  // Fetch user's votes
  const { data: userVotes = [] } = useQuery({
    queryKey: ["community-my-votes"],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("community_votes")
        .select("suggestion_id")
        .eq("user_id", user.id);
      return (data || []).map((v: any) => v.suggestion_id);
    },
    enabled: !!user,
  });

  // Fetch comments for expanded suggestion
  const { data: comments = [] } = useQuery({
    queryKey: ["community-comments", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data } = await supabase
        .from("community_comments")
        .select("*, profiles:user_id(display_name)")
        .eq("suggestion_id", expandedId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!expandedId,
  });

  // Fetch profiles for suggestions
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

  const submitSuggestion = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login primeiro");
      if (!title.trim() || !description.trim()) throw new Error("Preencha todos os campos");
      const { error } = await supabase.from("community_suggestions").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sugestão enviada!", description: "Será analisada pela equipe antes de ser publicada." });
      setTitle("");
      setDescription("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["community-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleVote = useMutation({
    mutationFn: async (suggestionId: string) => {
      if (!user) throw new Error("Faça login primeiro");
      const hasVoted = userVotes.includes(suggestionId);
      if (hasVoted) {
        await supabase.from("community_votes").delete().eq("suggestion_id", suggestionId).eq("user_id", user.id);
      } else {
        await supabase.from("community_votes").insert({ suggestion_id: suggestionId, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-my-votes"] });
      queryClient.invalidateQueries({ queryKey: ["community-suggestions"] });
    },
  });

  const submitComment = useMutation({
    mutationFn: async () => {
      if (!user || !expandedId || !commentText.trim()) throw new Error("Preencha o comentário");
      const { error } = await supabase.from("community_comments").insert({
        suggestion_id: expandedId,
        user_id: user.id,
        content: commentText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["community-comments", expandedId] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const approvedSuggestions = suggestions.filter((s: any) => s.status === "approved");
  const pendingSuggestions = suggestions.filter((s: any) => s.status === "pending" && s.user_id === user?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comunidade</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compartilhe ideias e vote nas sugestões da comunidade
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          Nova sugestão
        </Button>
      </div>

      {/* New suggestion form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-border bg-card p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" /> Sua ideia ou sugestão
            </h3>
            <p className="text-xs text-muted-foreground">
              Sua sugestão será analisada pela equipe antes de ser publicada para a comunidade votar.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input
                placeholder="Ex: Integração com WhatsApp..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                placeholder="Descreva sua ideia com detalhes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
              />
            </div>
            <Button
              onClick={() => submitSuggestion.mutate()}
              disabled={submitSuggestion.isPending || !title.trim() || !description.trim()}
              className="gap-1.5"
            >
              {submitSuggestion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar sugestão
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending user suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Suas sugestões aguardando aprovação
          </p>
          {pendingSuggestions.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Approved suggestions */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : approvedSuggestions.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Nenhuma sugestão aprovada ainda. Seja o primeiro!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvedSuggestions.map((s: any, i: number) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="flex items-start gap-4 p-4">
                {/* Vote button */}
                <button
                  onClick={() => toggleVote.mutate(s.id)}
                  className={`flex flex-col items-center gap-0.5 pt-1 transition-colors ${
                    userVotes.includes(s.id) ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <ThumbsUp className={`h-5 w-5 ${userVotes.includes(s.id) ? "fill-primary" : ""}`} />
                  <span className="text-xs font-bold">{s.votes_count}</span>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">{s.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[0.65rem] text-muted-foreground">
                    <span>{getDisplayName(s.user_id)}</span>
                    <span>•</span>
                    <span>{format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                </div>

                {/* Expand comments */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground shrink-0"
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {expandedId === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>

              {/* Comments section */}
              <AnimatePresence>
                {expandedId === s.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border"
                  >
                    <div className="p-4 space-y-3">
                      {comments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
                      ) : (
                        comments.map((c: any) => (
                          <div key={c.id} className="flex gap-3">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-bold text-primary shrink-0">
                              {(c.profiles?.display_name || "U").charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{c.profiles?.display_name || "Usuário"}</span>
                                <span className="text-[0.6rem] text-muted-foreground">
                                  {format(new Date(c.created_at), "dd/MM HH:mm")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{c.content}</p>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Comment input */}
                      <div className="flex gap-2 pt-2">
                        <Input
                          placeholder="Deixe um comentário..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          maxLength={500}
                          className="text-xs h-8"
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment.mutate()}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => submitComment.mutate()}
                          disabled={submitComment.isPending || !commentText.trim()}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
