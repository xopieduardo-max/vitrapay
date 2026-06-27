import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Send, Loader2, ArrowLeft, CheckCheck, Paperclip, X, Plus,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SupportAttachment } from "@/components/support/SupportAttachment";
import { convertImageToWebp, getImageFromClipboard } from "@/lib/toWebp";
import { useAssistantAvatars } from "@/hooks/useAssistantAvatars";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

interface Ticket {
  id: string;
  subject: string;
  status: string;
  last_message_at: string;
  unread_for_user: number;
  created_at: string;
}
interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_admin: boolean;
  body: string | null;
  created_at: string;
  edited_at?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  assistant_id?: string | null;
}

const statusMap: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  pending: { label: "Pendente", cls: "bg-green-500/10 text-green-600 border-green-500/30" },
  resolved: { label: "Resolvido", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  closed: { label: "Finalizado", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
};

const LOCKED_STATUSES = new Set(["resolved", "closed"]);

const initials = (s?: string) =>
  (s || "?").trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");

type Role = "Comprador" | "Produtor";

const TOPICS: Record<Role, string[]> = {
  Comprador: [
    "Acesso à área de membros",
    "Solicitar reembolso",
    "Dúvida sobre uma cobrança",
    "Outros assuntos",
  ],
  Produtor: [
    "Dúvida sobre saque",
    "Configuração de produto",
    "Integrações e pixels",
    "Outros assuntos",
  ],
};

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5">
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export default function Support() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  

  // Bot wizard state
  const [botRole, setBotRole] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("display_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });
  const firstName = (profile?.display_name || user?.email?.split("@")[0] || "Olá").split(" ")[0];

  const { data: assistants = [] } = useQuery({
    queryKey: ["active-assistants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_assistants")
        .select("id, name, role_label, avatar_url")
        .eq("active", true).order("sort_order").limit(5);
      return data || [];
    },
  });
  const assistantAvatars = useAssistantAvatars(assistants.map((a: any) => a.avatar_url));
  

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["support-tickets-mine", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets").select("*").eq("user_id", user!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Ticket[];
    },
    enabled: !!user,
  });

  // No auto-select: the user lands on the home (hero + ticket list) and chooses.

  const { data: messages = [] } = useQuery({
    queryKey: ["support-messages", selected],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages").select("*").eq("ticket_id", selected!).order("created_at");
      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: !!selected,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("support-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["support-tickets-mine"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" },
        (payload: any) => {
          const tid = (payload.new as any)?.ticket_id || (payload.old as any)?.ticket_id;
          if (tid === selected) qc.invalidateQueries({ queryKey: ["support-messages", selected] });
          qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selected, qc]);

  useEffect(() => {
    if (selected) {
      supabase.rpc("mark_support_ticket_read", { _ticket_id: selected }).then(() => {
        qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
        qc.invalidateQueries({ queryKey: ["unread-support"] });
      });
    }
  }, [selected, messages.length, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, selected]);

  const ticket = tickets.find((t) => t.id === selected);
  const ticketLocked = ticket && LOCKED_STATUSES.has(ticket.status);
  const totalUnread = tickets.reduce((a, t) => a + (t.unread_for_user || 0), 0);

  const { isOtherTyping, notifyTyping, notifyStop } = useTypingIndicator({
    ticketId: selected,
    isAdmin: false,
    enabled: !!selected && !ticketLocked,
  });

  // The active assistant for this ticket = the most recent admin message's assistant.
  const currentAssistant = useMemo(() => {
    const lastAdminMsg = [...messages].reverse().find((m) => m.is_admin && m.assistant_id);
    if (lastAdminMsg) return assistants.find((a: any) => a.id === lastAdminMsg.assistant_id) || null;
    return null;
  }, [messages, assistants]);

  // ---------- Bot quick-start: create a ticket from chip click ----------
  const startConversation = async (role: Role, topic: string) => {
    if (!user || creating) return;
    setCreating(true);
    const subject = `[${role}] ${topic}`;
    const { data: t, error } = await supabase
      .from("support_tickets").insert({ user_id: user!.id, subject }).select().single();
    if (error || !t) { setCreating(false); toast.error("Erro ao iniciar conversa."); return; }
    // Seed with the user's own first message describing the topic — keeps the admin context.
    await supabase.from("support_messages").insert({
      ticket_id: t.id, sender_id: user!.id, is_admin: false,
      body: `Assunto: ${topic}`,
    });
    setCreating(false);
    setSelected(t.id);
    setBotRole(null);
    qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
  };

  // ---------- Attachments ----------
  const pickAttachment = async (file: File | null) => {
    if (!file) return setAttachment(null);
    let f = file;
    if (f.type.startsWith("image/")) f = await convertImageToWebp(f);
    if (!ACCEPTED_MIME.includes(f.type)) { toast.error("Tipo de arquivo não suportado."); return; }
    if (f.size > MAX_BYTES) { toast.error("Arquivo muito grande (máx. 10 MB)."); return; }
    setAttachment(f);
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const img = getImageFromClipboard(e);
    if (img) { e.preventDefault(); pickAttachment(img); toast.success("Imagem colada do clipboard"); }
  };
  const uploadAttachment = async (ticketId: string) => {
    if (!attachment) return null;
    const ext = attachment.name.split(".").pop() || "bin";
    const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("support-attachments")
      .upload(path, attachment, { contentType: attachment.type, upsert: false });
    if (error) { toast.error("Falha ao enviar anexo."); return null; }
    return { path, name: attachment.name, type: attachment.type };
  };

  const sendReply = async () => {
    if ((!reply.trim() && !attachment) || !selected) return;
    if (ticket && LOCKED_STATUSES.has(ticket.status)) {
      toast.error("Esta conversa foi finalizada. Inicie uma nova abaixo.");
      return;
    }
    setSending(true);
    const uploaded = await uploadAttachment(selected);
    if (attachment && !uploaded) { setSending(false); return; }
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected, sender_id: user!.id, is_admin: false,
      body: reply.trim() || null,
      attachment_url: uploaded?.path ?? null,
      attachment_name: uploaded?.name ?? null,
      attachment_type: uploaded?.type ?? null,
    } as any);
    setSending(false);
    if (error) { toast.error("Erro ao enviar."); return; }
    setReply(""); setAttachment(null);
    notifyStop();
    qc.invalidateQueries({ queryKey: ["support-messages", selected] });
  };

  // ============== RENDER: active chat ==============
  if (selected && ticket) {
    return (
      <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)]">
        <Card className="border-border flex flex-col p-0 overflow-hidden flex-1 min-h-0 rounded-3xl">
          {/* Header com apenas a foto do atendente atual */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-amber-500 to-yellow-600 px-4 py-4 border-b border-border">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)] pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-black/10" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-11 w-11 ring-2 ring-white shadow-md">
                {currentAssistant?.avatar_url && (
                  <AvatarImage src={assistantAvatars[currentAssistant.avatar_url] || ""} alt={currentAssistant.name} />
                )}
                <AvatarFallback className="text-xs bg-black text-primary font-bold">
                  {currentAssistant ? initials(currentAssistant.name) : "VP"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-black truncate">
                  {currentAssistant?.name || "Suporte VitraPay"}
                </p>
                <p className="text-[0.7rem] text-black/70 truncate flex items-center gap-1">
                  {isOtherTyping ? (
                    <span className="flex items-center gap-1 font-medium">
                      digitando<TypingDots />
                    </span>
                  ) : (
                    currentAssistant?.role_label || "Em breve um atendente responderá"
                  )}
                </p>
              </div>
              <Badge variant="outline" className={`text-[0.6rem] bg-white/90 ${statusMap[ticket.status]?.cls}`}>
                {statusMap[ticket.status]?.label}
              </Badge>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background/30">
            {messages.map((m) => {
              const asst = m.is_admin && m.assistant_id ? assistants.find((a: any) => a.id === m.assistant_id) : null;
              const asstAvatar = asst?.avatar_url ? assistantAvatars[asst.avatar_url] : "";
              return (
                <div key={m.id} className={`flex items-end gap-2 ${m.is_admin ? "justify-start" : "justify-end"}`}>
                  {m.is_admin && (
                    <Avatar className="h-7 w-7 shrink-0">
                      {asstAvatar && <AvatarImage src={asstAvatar} alt={asst?.name} />}
                      <AvatarFallback className="text-[0.6rem] bg-primary/15 text-primary">
                        {asst ? initials(asst.name) : "VP"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.is_admin ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                    {m.is_admin && (
                      <p className="text-[0.65rem] font-semibold text-primary mb-0.5">
                        {asst ? `${asst.name}${asst.role_label ? ` · ${asst.role_label}` : ""}` : "VitraPay"}
                      </p>
                    )}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachment_url && (
                      <SupportAttachment
                        path={m.attachment_url} name={m.attachment_name} type={m.attachment_type}
                        ownBubble={!m.is_admin}
                      />
                    )}
                    <p className="text-[0.6rem] opacity-70 mt-1 flex items-center gap-1 justify-end">
                      {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      {m.edited_at && <span className="italic">· editada</span>}
                      {!m.is_admin && <CheckCheck className="h-3 w-3" />}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer / locked footer */}
          {ticketLocked ? (
            <div className="border-t border-border p-4 bg-muted/20 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Esta conversa foi <span className="font-semibold">{statusMap[ticket.status]?.label.toLowerCase()}</span>.
              </p>
              <Button size="sm" onClick={() => { setSelected(null); setBotRole(null); }} className="gap-2">
                <Plus className="h-4 w-4" /> Iniciar nova conversa
              </Button>
            </div>
          ) : (
            <div className="border-t border-border p-3 space-y-2">
              {attachment && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1">{attachment.name}</span>
                  <span className="text-muted-foreground">{(attachment.size / 1024).toFixed(0)} KB</span>
                  <button type="button" onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-foreground" aria-label="Remover anexo">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="flex items-center justify-center h-auto px-3 rounded-md border border-input bg-background hover:bg-accent cursor-pointer shrink-0" title="Anexar imagem ou PDF">
                  <Paperclip className="h-4 w-4" />
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => pickAttachment(e.target.files?.[0] || null)} />
                </label>
                <Textarea
                  value={reply}
                  onChange={(e) => { setReply(e.target.value); notifyTyping(); }}
                  placeholder="Digite sua mensagem..."
                  rows={2} className="resize-none" lang="pt-BR" spellCheck
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                  }}
                />
                <Button onClick={sendReply} disabled={sending || (!reply.trim() && !attachment)} className="h-auto">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ============== RENDER: home (hero + topic flow + tickets list) ==============
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-[#080808] text-white min-h-[calc(100dvh-7rem)]">
      {/* Animated yellow gradient blobs — mesmo estilo da tela de login */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-32 top-0 h-[500px] w-[500px] rounded-full opacity-80 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(48, 96%, 53%) 0%, hsl(38, 92%, 45%) 40%, transparent 70%)" }}
        />
        <div
          className="absolute -left-40 -bottom-20 h-[450px] w-[450px] rounded-full opacity-60 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(38, 92%, 50%) 0%, hsl(20, 85%, 40%) 50%, transparent 75%)" }}
        />
        <div
          className="absolute right-1/3 top-10 h-[260px] w-[260px] rounded-full opacity-40 blur-[100px]"
          style={{ background: "radial-gradient(circle, hsl(54, 100%, 60%) 0%, transparent 70%)" }}
        />
      </div>

      {/* Back button */}
      <div className="absolute top-3 left-3 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-white/10 rounded-full"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative z-10 px-5 md:px-10 pt-16 pb-8 max-w-3xl mx-auto">
        {/* Avatar stack */}
        <div className="flex -space-x-3 mb-5">
          {(assistants.slice(0, 4) as any[]).map((a) => (
            <Avatar key={a.id} className="h-14 w-14 ring-2 ring-white/90 shadow-lg">
              {a.avatar_url && <AvatarImage src={assistantAvatars[a.avatar_url] || ""} alt={a.name} />}
              <AvatarFallback className="text-xs bg-black text-primary font-bold">
                {initials(a.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {assistants.length === 0 && (
            <Avatar className="h-14 w-14 ring-2 ring-white/90">
              <AvatarFallback className="text-sm bg-black text-primary font-bold">VP</AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Greeting */}
        <h1 className="text-3xl md:text-4xl font-bold text-white/90 leading-tight">
          Olá {firstName} <span className="inline-block">👋</span>
        </h1>
        <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
          Como podemos te ajudar hoje?
        </h2>

        {/* Topic flow card */}
        <Card className="mt-6 p-4 md:p-5 bg-black/60 backdrop-blur-md border-white/10 rounded-2xl">
          {!botRole ? (
            <>
              <p className="text-sm text-white/80 mb-3">
                Você é <span className="font-semibold text-primary">Comprador</span> ou <span className="font-semibold text-primary">Produtor</span>?
              </p>
              <div className="flex flex-wrap gap-2">
                {(["Comprador", "Produtor"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setBotRole(r)}
                    className="rounded-full border-2 border-primary text-primary px-5 py-2 text-sm font-medium hover:bg-primary hover:text-black transition"
                  >
                    Sou {r}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-white/80">
                  Sobre o que <span className="font-semibold text-primary">{botRole}</span> gostaria de falar?
                </p>
                <button
                  onClick={() => setBotRole(null)}
                  className="text-[0.7rem] text-white/60 hover:text-white"
                >
                  ← trocar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {TOPICS[botRole].map((topic) => (
                  <button
                    key={topic}
                    disabled={creating}
                    onClick={() => startConversation(botRole, topic)}
                    className="rounded-full border-2 border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-primary hover:text-black transition disabled:opacity-60"
                  >
                    {topic}
                  </button>
                ))}
              </div>
              {creating && (
                <div className="flex justify-center pt-3">
                  <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Tickets list */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-white/60">
              Seus chamados
            </p>
            {totalUnread > 0 && (
              <span className="text-[0.6rem] bg-primary text-black rounded-full px-2 py-0.5 font-semibold">
                {totalUnread} novas
              </span>
            )}
          </div>

          {ticketsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/60" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-white/50 py-6 text-center bg-black/40 rounded-2xl border border-white/5">
              Você ainda não abriu nenhum chamado.
            </p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className="w-full text-left p-3 rounded-2xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 transition group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium text-white truncate flex-1 group-hover:text-primary transition">
                      {t.subject}
                    </p>
                    {t.unread_for_user > 0 && (
                      <span className="text-[0.6rem] bg-primary text-black rounded-full px-2 py-0.5 min-w-[20px] text-center font-bold">
                        {t.unread_for_user}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[0.7rem]">
                    <Badge variant="outline" className={`text-[0.6rem] ${statusMap[t.status]?.cls}`}>
                      {statusMap[t.status]?.label || t.status}
                    </Badge>
                    <span className="text-white/50">
                      {format(new Date(t.last_message_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
