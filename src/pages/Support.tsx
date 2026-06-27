import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { MessageSquare, Plus, Send, Loader2, ArrowLeft, CheckCheck, Paperclip, X, MessageCircle, Lightbulb, Bug, Search, ArrowUp } from "lucide-react";
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

export default function Support() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newPrefix, setNewPrefix] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [firstMsg, setFirstMsg] = useState("");
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
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
        .eq("active", true)
        .order("sort_order")
        .limit(5);
      return data || [];
    },
  });
  const assistantAvatars = useAssistantAvatars(assistants.map((a: any) => a.avatar_url));

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

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets-mine", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Ticket[];
    },
    enabled: !!user,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["support-messages", selected],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selected!)
        .order("created_at");
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

  const openNewWithPrefix = (prefix: string, initial: string) => {
    setNewPrefix(prefix);
    setSubject(initial);
    setFirstMsg("");
    setNewOpen(true);
  };

  const createTicket = async () => {
    const finalSubject = newPrefix ? `[${newPrefix}] ${subject.trim()}` : subject.trim();
    if (!subject.trim() || !firstMsg.trim()) { toast.error("Preencha assunto e mensagem."); return; }
    setSending(true);
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user!.id, subject: finalSubject })
      .select().single();
    if (error || !t) { setSending(false); toast.error("Erro ao abrir ticket."); return; }
    await supabase.from("support_messages").insert({
      ticket_id: t.id, sender_id: user!.id, is_admin: false, body: firstMsg.trim(),
    });
    setSending(false);
    setNewOpen(false);
    setSubject(""); setFirstMsg(""); setNewPrefix("");
    setSelected(t.id);
    qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
    toast.success("Chamado aberto! Em breve respondemos.");
  };

  const ticket = tickets.find((t) => t.id === selected);

  const sendReply = async () => {
    if ((!reply.trim() && !attachment) || !selected) return;
    if (ticket && LOCKED_STATUSES.has(ticket.status)) {
      toast.error("Este chamado foi encerrado. Abra um novo chamado para continuar.");
      return;
    }
    setSending(true);
    const uploaded = await uploadAttachment(selected);
    if (attachment && !uploaded) { setSending(false); return; }
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected,
      sender_id: user!.id,
      is_admin: false,
      body: reply.trim() || null,
      attachment_url: uploaded?.path ?? null,
      attachment_name: uploaded?.name ?? null,
      attachment_type: uploaded?.type ?? null,
    } as any);
    setSending(false);
    if (error) { toast.error("Erro ao enviar."); return; }
    setReply("");
    setAttachment(null);
    qc.invalidateQueries({ queryKey: ["support-messages", selected] });
  };

  const ticketLocked = ticket && LOCKED_STATUSES.has(ticket.status);
  const totalUnread = tickets.reduce((a, t) => a + (t.unread_for_user || 0), 0);

  // ---------- IF a chat is open, render the chat fullscreen-ish ----------
  if (selected) {
    return (
      <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)]">
        <Card className="border-border flex flex-col p-0 overflow-hidden flex-1 min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {assistants.length > 0 ? (
              <div className="flex -space-x-2 shrink-0">
                {assistants.slice(0, 3).map((a: any) => (
                  <Avatar key={a.id} className="h-9 w-9 ring-2 ring-card">
                    {a.avatar_url && <AvatarImage src={assistantAvatars[a.avatar_url] || ""} alt={a.name} />}
                    <AvatarFallback className="text-[0.6rem] bg-primary/15 text-primary">{initials(a.name)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            ) : (
              <Avatar className="h-9 w-9 bg-primary/10">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">VP</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Suporte VitraPay</p>
              <p className="text-[0.7rem] text-muted-foreground truncate">{ticket?.subject}</p>
            </div>
            <Badge variant="outline" className={`text-[0.6rem] ${statusMap[ticket?.status || "open"]?.cls}`}>
              {statusMap[ticket?.status || "open"]?.label}
            </Badge>
          </div>

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
                        path={m.attachment_url}
                        name={m.attachment_name}
                        type={m.attachment_type}
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

          {ticketLocked ? (
            <div className="border-t border-border p-4 bg-muted/20 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Este chamado foi <span className="font-semibold">{statusMap[ticket!.status]?.label.toLowerCase()}</span> pelo suporte.
              </p>
              <Button size="sm" onClick={() => { setSelected(null); setNewOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Abrir novo chamado
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
                  rows={2}
                  className="resize-none"
                  lang="pt-BR"
                  spellCheck
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
        {/* New ticket dialog reused below */}
        <NewTicketDialog
          open={newOpen} onOpenChange={setNewOpen} prefix={newPrefix}
          subject={subject} setSubject={setSubject} firstMsg={firstMsg} setFirstMsg={setFirstMsg}
          sending={sending} createTicket={createTicket}
        />
      </div>
    );
  }

  // ---------- LANDING (no chat selected) ----------
  return (
    <div className="space-y-6 pb-8">
      {/* Hero gradient card */}
      <div className="relative overflow-hidden rounded-3xl border border-border">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, hsl(48 96% 53%) 0%, hsl(48 96% 40%) 35%, hsl(40 80% 18%) 75%, hsl(0 0% 4%) 100%)",
          }}
        />
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-yellow-300/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-black/40 blur-3xl" />

        <div className="relative px-5 md:px-8 py-7 md:py-10">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost" size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-9 w-9 text-black/80 hover:text-black hover:bg-black/10"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {totalUnread > 0 && (
              <Badge className="bg-black text-yellow-400 border-0">
                {totalUnread} nova{totalUnread > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {assistants.length > 0 ? (
            <div className="flex -space-x-3 mb-4">
              {assistants.slice(0, 3).map((a: any) => (
                <Avatar key={a.id} className="h-12 w-12 ring-2 ring-yellow-300/50 shadow-lg">
                  {a.avatar_url && <AvatarImage src={assistantAvatars[a.avatar_url] || ""} alt={a.name} />}
                  <AvatarFallback className="text-xs bg-black text-yellow-400 font-semibold">{initials(a.name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : (
            <div className="h-12 w-12 mb-4 rounded-full bg-black/30 flex items-center justify-center text-yellow-400 font-bold">VP</div>
          )}

          <h1 className="text-2xl md:text-3xl font-bold text-black/70 tracking-tight">
            Olá {firstName} <span className="inline-block">👋</span>
          </h1>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-1 leading-tight drop-shadow">
            Como podemos te ajudar hoje?
          </h2>

          {/* Quick input → opens new ticket */}
          <button
            onClick={() => openNewWithPrefix("", quickQuery)}
            className="mt-5 w-full md:max-w-xl flex items-center gap-2 rounded-full bg-white pl-5 pr-2 py-2 shadow-xl hover:shadow-2xl transition group"
          >
            <span className="flex-1 text-left text-sm text-gray-500 truncate">
              Como posso ajudar?
            </span>
            <span className="h-9 w-9 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black shadow group-hover:scale-105 transition">
              <ArrowUp className="h-4 w-4" />
            </span>
          </button>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => openNewWithPrefix("Suporte", "")}
              className="flex items-center gap-2 rounded-full bg-white/95 hover:bg-white px-3.5 py-1.5 text-xs font-medium text-gray-800 shadow"
            >
              <MessageCircle className="h-3.5 w-3.5 text-blue-600" /> Suporte
            </button>
            <button
              onClick={() => openNewWithPrefix("Sugestão", "")}
              className="flex items-center gap-2 rounded-full bg-white/95 hover:bg-white px-3.5 py-1.5 text-xs font-medium text-gray-800 shadow"
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Sugerir melhoria
            </button>
            <button
              onClick={() => openNewWithPrefix("BUG", "")}
              className="flex items-center gap-2 rounded-full bg-white/95 hover:bg-white px-3.5 py-1.5 text-xs font-medium text-gray-800 shadow"
            >
              <Bug className="h-3.5 w-3.5 text-rose-600" /> Reportar BUG
            </button>
          </div>
        </div>
      </div>

      {/* Central de Ajuda search */}
      <Card className="border-border p-4">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Central de Ajuda — busque artigos…"
            className="border-0 px-0 focus-visible:ring-0 shadow-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickQuery.trim()) navigate(`/help?q=${encodeURIComponent(quickQuery)}`);
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => navigate("/help")}>Abrir</Button>
        </div>
      </Card>

      {/* Existing tickets */}
      <Card className="border-border p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Seus chamados ({tickets.length})
          </p>
          <Button size="sm" variant="outline" onClick={() => setNewOpen(true)} className="gap-2 h-8">
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum chamado ainda. Use os botões acima para abrir um.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className="w-full text-left px-4 py-3 hover:bg-muted/30 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium truncate flex-1">{t.subject}</p>
                  {t.unread_for_user > 0 && (
                    <span className="text-[0.6rem] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {t.unread_for_user}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <Badge variant="outline" className={`text-[0.6rem] ${statusMap[t.status]?.cls}`}>
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
      </Card>

      <NewTicketDialog
        open={newOpen} onOpenChange={setNewOpen} prefix={newPrefix}
        subject={subject} setSubject={setSubject} firstMsg={firstMsg} setFirstMsg={setFirstMsg}
        sending={sending} createTicket={createTicket}
      />
    </div>
  );
}

function NewTicketDialog({
  open, onOpenChange, prefix, subject, setSubject, firstMsg, setFirstMsg, sending, createTicket,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; prefix: string;
  subject: string; setSubject: (s: string) => void;
  firstMsg: string; setFirstMsg: (s: string) => void;
  sending: boolean; createTicket: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{prefix ? `Novo: ${prefix}` : "Abrir novo chamado"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="Assunto (ex: Dúvida sobre saque)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
          />
          <Textarea
            placeholder="Descreva sua dúvida ou problema..."
            value={firstMsg}
            onChange={(e) => setFirstMsg(e.target.value)}
            rows={5}
            maxLength={2000}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={createTicket} disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
