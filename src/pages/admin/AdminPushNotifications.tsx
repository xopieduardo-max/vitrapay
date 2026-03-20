import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Loader2, Send, Users, Clock, History } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const EMOJI_SUGGESTIONS = ["🎉", "🔥", "💰", "⚡", "🚀", "📢", "🎁", "✨", "💎", "🏆", "📣", "💥"];

export default function AdminPushNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [sending, setSending] = useState(false);

  const { data: subCount } = useQuery({
    queryKey: ["push-sub-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("push_subscriptions")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["push-notifications-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("push_notifications_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const addEmoji = (emoji: string) => {
    setTitle((prev) => prev + emoji);
  };

  const handleSend = async () => {
    if (!title.trim() || !user) {
      toast.error("Digite um título para a notificação.");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          broadcast: true,
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/dashboard",
        },
      });

      if (error) throw error;

      const result = data as any;

      // Save to history log
      await supabase.from("push_notifications_log").insert({
        title: title.trim(),
        body: body.trim() || null,
        url: url.trim() || "/dashboard",
        sent_count: result.sent || 0,
        total_devices: result.total || 0,
        sent_by: user.id,
      } as any);

      queryClient.invalidateQueries({ queryKey: ["push-notifications-log"] });

      if (result.sent > 0) {
        toast.success(`Notificação enviada para ${result.sent} dispositivo(s)!`);
        setTitle("");
        setBody("");
        setUrl("/dashboard");
      } else {
        toast.warning("Nenhum dispositivo inscrito encontrado.");
      }
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e.message || String(e)));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notificações Push</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie notificações push para todos os usuários da plataforma
        </p>
      </div>

      {/* Stats */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{subCount ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Dispositivos inscritos</p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-primary" />
          Compor notificação
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Nova promoção disponível! 🎉"
            className="bg-muted/50 border-transparent focus:border-border"
            maxLength={100}
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {EMOJI_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addEmoji(emoji)}
                className="text-lg hover:scale-125 transition-transform cursor-pointer select-none"
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Mensagem</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Descreva a novidade ou promoção..."
            className="bg-muted/50 border-transparent focus:border-border resize-none"
            rows={3}
            maxLength={300}
          />
          <p className="text-xs text-muted-foreground text-right">{body.length}/300</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Link (opcional)</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/dashboard"
            className="bg-muted/50 border-transparent focus:border-border"
          />
          <p className="text-xs text-muted-foreground">
            Para onde o usuário vai ao clicar na notificação
          </p>
        </div>

        {/* Preview */}
        {title && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Pré-visualização</p>
            <div className="flex items-start gap-3 pt-1">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{title}</p>
                {body && <p className="text-xs text-muted-foreground line-clamp-2">{body}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSend} disabled={sending || !title.trim()} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar para todos
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <History className="h-3.5 w-3.5" />
            Histórico de envios
          </h2>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma notificação enviada ainda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(history as any[]).map((item) => (
              <div key={item.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.body && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.body}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {item.sent_count}/{item.total_devices}
                    </span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="text-[0.65rem]">
                        {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
