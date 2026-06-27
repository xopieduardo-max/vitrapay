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
  Send, Loader2, ArrowLeft, CheckCheck, Paperclip, X, Plus, History,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SupportAttachment } from "@/components/support/SupportAttachment";
import { convertImageToWebp, getImageFromClipboard } from "@/lib/toWebp";
import { useAssistantAvatars } from "@/hooks/useAssistantAvatars";

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

export default function Support() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
  const heroAssistant = assistants[0] as any | undefined;

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
    qc.invalidateQueries({ queryKey: ["support-messages", selected] });
  };

  // ============== RENDER: active chat ==============
  if (selected && ticket) {
    return (
      <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)]">
        <Card className="border-border flex flex-col p-0 overflow-hidden flex-1 min-h-0 rounded-3xl">
          {/* Header com hero degradê + pilha de avatares */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-amber-500 to-yellow-600 px-4 py-4 border-b border-border">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)] pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-black/10" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex -space-x-2">
                {(assistants.slice(0, 4) as any[]).map((a) => (
                  <Avatar key={a.id} className="h-9 w-9 ring-2 ring-white/80">
                    {a.avatar_url && <AvatarImage src={assistantAvatars[a.avatar_url] || ""} alt={a.name} />}
                    <AvatarFallback className="text-[0.6rem] bg-black text-primary font-bold">
                      {initials(a.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {assistants.length === 0 && (
                  <Avatar className="h-9 w-9 ring-2 ring-white/80">
                    <AvatarFallback className="text-[0.65rem] bg-black text-primary font-bold">VP</AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-black truncate">
                  {heroAssistant?.name || "Suporte VitraPay"}
                </p>
                <p className="text-[0.7rem] text-black/70 truncate">
                  {heroAssistant?.role_label || "Responderemos em instantes"}
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
                  onChange={(e) => setReply(e.target.value)}
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

  // ============== RENDER: bot wizard (no active conversation) ==============
  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)]">
      <Card className="border-border flex flex-col p-0 overflow-hidden flex-1 min-h-0 rounded-3xl">
        {/* Header com hero degradê + pilha de avatares */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-amber-500 to-yellow-600 px-4 py-5 border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)] pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-black/10" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex -space-x-2">
              {(assistants.slice(0, 4) as any[]).map((a) => (
                <Avatar key={a.id} className="h-10 w-10 ring-2 ring-white/80">
                  {a.avatar_url && <AvatarImage src={assistantAvatars[a.avatar_url] || ""} alt={a.name} />}
                  <AvatarFallback className="text-[0.65rem] bg-black text-primary font-bold">
                    {initials(a.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {assistants.length === 0 && (
                <Avatar className="h-10 w-10 ring-2 ring-white/80">
                  <AvatarFallback className="text-[0.7rem] bg-black text-primary font-bold">VP</AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-black truncate">{heroAssistant?.name || "Assistente VitraPay"}</p>
              <p className="text-[0.7rem] text-black/70 truncate">Nosso time responderá em instantes</p>
            </div>
            {tickets.length > 0 && (
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-black hover:bg-black/10" onClick={() => setShowHistory((v) => !v)}>
                <History className="h-3.5 w-3.5" />
                Histórico
                {totalUnread > 0 && (
                  <span className="ml-1 text-[0.55rem] bg-black text-primary rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                    {totalUnread}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Conversation surface */}
        <div className="flex-1 overflow-y-auto px-4 py-5 bg-background/30 space-y-4">
          {/* Bot greeting */}
          <div className="flex items-end gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              {heroAssistant?.avatar_url && <AvatarImage src={assistantAvatars[heroAssistant.avatar_url] || ""} alt={heroAssistant.name} />}
              <AvatarFallback className="text-[0.6rem] bg-primary/15 text-primary">
                {heroAssistant ? initials(heroAssistant.name) : "VP"}
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm bg-muted text-foreground">
              <p className="text-[0.65rem] font-semibold text-primary mb-0.5">
                {heroAssistant?.name || "VitraPay"}
              </p>
              <p>
                Olá <span className="font-semibold">{firstName}</span>! 👋 Bem-vindo(a) ao suporte da VitraPay.
                <br />Sobre o que você gostaria de falar hoje?
              </p>
              <p className="text-[0.6rem] opacity-70 mt-1 text-right">agora</p>
            </div>
          </div>

          {/* Step 1: role chips */}
          {!botRole && (
            <div className="flex flex-col items-end gap-2 pr-1">
              {(["Comprador", "Produtor"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setBotRole(r)}
                  className="rounded-full border-2 border-primary text-primary px-5 py-2 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition shadow-sm"
                >
                  Sou {r}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: confirmation bubble + topic chips */}
          {botRole && (
            <>
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm bg-primary text-primary-foreground">
                  Sou {botRole}
                  <p className="text-[0.6rem] opacity-70 mt-1 text-right">agora</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 pr-1">
                {TOPICS[botRole].map((topic) => (
                  <button
                    key={topic}
                    disabled={creating}
                    onClick={() => startConversation(botRole, topic)}
                    className="rounded-full border-2 border-primary text-primary px-5 py-2 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition shadow-sm disabled:opacity-60"
                  >
                    {topic}
                  </button>
                ))}
                <button
                  onClick={() => setBotRole(null)}
                  className="text-[0.7rem] text-muted-foreground hover:text-foreground mt-1"
                >
                  ← voltar
                </button>
              </div>
            </>
          )}

          {creating && (
            <div className="flex justify-center pt-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Optional history */}
          {showHistory && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Conversas anteriores
              </p>
              {ticketsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : tickets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Sem conversas anteriores.</p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-card">
                  {tickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium truncate flex-1">{t.subject}</p>
                        {t.unread_for_user > 0 && (
                          <span className="text-[0.55rem] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                            {t.unread_for_user}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[0.65rem]">
                        <Badge variant="outline" className={`text-[0.55rem] ${statusMap[t.status]?.cls}`}>
                          {statusMap[t.status]?.label || t.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {format(new Date(t.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-3 bg-card/60 text-center">
          <p className="text-[0.7rem] text-muted-foreground">
            Escolha uma opção acima para iniciar uma nova conversa com o suporte.
          </p>
        </div>
      </Card>
    </div>
  );
}
