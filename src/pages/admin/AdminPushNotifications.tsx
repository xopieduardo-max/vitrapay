import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Loader2, Send, Users, Clock, History, User, Search, Smartphone, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const EMOJI_SUGGESTIONS = ["🎉", "🔥", "💰", "⚡", "🚀", "📢", "🎁", "✨", "💎", "🏆", "📣", "💥"];

type SendMode = "all" | "user";

export default function AdminPushNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode>("all");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; email: string } | null>(null);

  // Count subscriptions + unique users
  const { data: subStats } = useQuery({
    queryKey: ["push-sub-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("user_id");
      if (error) throw error;
      const devices = data?.length || 0;
      const uniqueUsers = new Set(data?.map((s) => s.user_id)).size;
      return { devices, uniqueUsers };
    },
  });

  // Search users with subscriptions
  const { data: searchResults = [] } = useQuery({
    queryKey: ["push-user-search", userSearch],
    queryFn: async () => {
      if (userSearch.length < 2) return [];
      
      // Get profiles matching search
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .ilike("display_name", `%${userSearch}%`)
        .limit(10);

      if (!profiles?.length) return [];

      // Get emails
      const { data: emails } = await supabase.rpc("get_user_emails");

      // Get subscriptions to know who has devices
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("user_id");
      
      const subUserIds = new Set(subs?.map((s) => s.user_id) || []);
      const emailMap = new Map((emails || []).map((e) => [e.user_id, e.email]));

      return profiles
        .filter((p) => subUserIds.has(p.user_id))
        .map((p) => ({
          id: p.user_id,
          name: p.display_name || "Sem nome",
          email: emailMap.get(p.user_id) || "",
          deviceCount: subs?.filter((s) => s.user_id === p.user_id).length || 0,
        }));
    },
    enabled: userSearch.length >= 2 && sendMode === "user",
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

    if (sendMode === "user" && !selectedUser) {
      toast.error("Selecione um usuário para enviar.");
      return;
    }

    setSending(true);
    try {
      const payload: any = {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || "/dashboard",
      };

      if (sendMode === "all") {
        payload.broadcast = true;
      } else {
        payload.producer_id = selectedUser!.id;
      }

      const { data, error } = await supabase.functions.invoke("send-push", {
        body: payload,
      });

      if (error) throw error;

      const result = data as any;

      await supabase.from("push_notifications_log").insert({
        title: title.trim(),
        body: body.trim() || null,
        url: url.trim() || "/dashboard",
        sent_count: result.sent || 0,
        total_devices: result.total || 0,
        sent_by: user.id,
      } as any);

      queryClient.invalidateQueries({ queryKey: ["push-notifications-log"] });
      queryClient.invalidateQueries({ queryKey: ["push-sub-stats"] });

      if (result.sent > 0) {
        const target = sendMode === "user" ? selectedUser!.name : "todos";
        toast.success(`Notificação enviada para ${target} (${result.sent} dispositivo(s))!`);
        setTitle("");
        setBody("");
        setUrl("/dashboard");
        setSelectedUser(null);
        setUserSearch("");
      } else if ((result.invalidated ?? 0) > 0) {
        toast.warning(
          `Encontramos ${result.total || 0} dispositivo(s), mas a inscrição estava inválida e foi limpa. Abra o app novamente no celular para reinscrever o dispositivo.`
        );
      } else {
        toast.warning("Nenhum dispositivo inscrito encontrado.");
      }
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e.message || String(e)));
    } finally {
      setSending(false);
    }
  };

  const sendButtonLabel = useMemo(() => {
    if (sendMode === "user") {
      return selectedUser ? `Enviar para ${selectedUser.name}` : "Selecione um usuário";
    }
    return `Enviar para todos (${subStats?.devices ?? "—"} dispositivos)`;
  }, [sendMode, selectedUser, subStats]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notificações Push</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie notificações push para os usuários da plataforma
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{subStats?.uniqueUsers ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Usuários inscritos</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{subStats?.devices ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Dispositivos totais</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-primary" />
          Compor notificação
        </div>

        {/* Send mode toggle */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Enviar para</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setSendMode("all"); setSelectedUser(null); setUserSearch(""); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
                sendMode === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Users className="h-4 w-4" />
              Todos ({subStats?.uniqueUsers ?? "—"})
            </button>
            <button
              type="button"
              onClick={() => setSendMode("user")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
                sendMode === "user"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <User className="h-4 w-4" />
              Pessoa específica
            </button>
          </div>
        </div>

        {/* User search */}
        {sendMode === "user" && (
          <div className="space-y-2">
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedUser(null); setUserSearch(""); }}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="pl-9 bg-muted/50 border-transparent focus:border-border"
                    autoComplete="off"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="rounded-lg border border-border bg-card divide-y divide-border max-h-48 overflow-y-auto">
                    {searchResults.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedUser({ id: u.id, name: u.name, email: u.email }); setUserSearch(""); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{u.deviceCount} disp.</span>
                      </button>
                    ))}
                  </div>
                )}
                {userSearch.length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">
                    Nenhum usuário com dispositivo inscrito encontrado.
                  </p>
                )}
              </>
            )}
          </div>
        )}

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
          <Button
            onClick={handleSend}
            disabled={sending || !title.trim() || (sendMode === "user" && !selectedUser)}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sendButtonLabel}
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
                    <span className="text-xs font-medium text-primary" title="Enviados / Total de dispositivos">
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
