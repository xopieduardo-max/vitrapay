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
import { MessageSquare, Plus, Send, Loader2, Mail, ArrowLeft, CheckCheck, Paperclip, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import vitrapayLogo from "@/assets/logo-vitrapay-icon-square.webp";
import { SupportAttachment } from "@/components/support/SupportAttachment";
import { convertImageToWebp, getImageFromClipboard } from "@/lib/toWebp";

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
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
}

const statusMap: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  pending: { label: "Pendente", cls: "bg-green-500/10 text-green-600 border-green-500/30" },
  resolved: { label: "Resolvido", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  closed: { label: "Finalizado", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
};

const LOCKED_STATUSES = new Set(["resolved", "closed"]);

export default function Support() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [firstMsg, setFirstMsg] = useState("");
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pickAttachment = async (file: File | null) => {
    if (!file) return setAttachment(null);
    let f = file;
    if (f.type.startsWith("image/")) {
      f = await convertImageToWebp(f);
    }
    if (!ACCEPTED_MIME.includes(f.type)) {
      toast.error("Tipo de arquivo não suportado. Envie imagem ou PDF.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo muito grande (máx. 10 MB).");
      return;
    }
    setAttachment(f);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const img = getImageFromClipboard(e);
    if (img) {
      e.preventDefault();
      pickAttachment(img);
      toast.success("Imagem colada do clipboard");
    }
  };

  const uploadAttachment = async (ticketId: string): Promise<{ path: string; name: string; type: string } | null> => {
    if (!attachment) return null;
    const ext = attachment.name.split(".").pop() || "bin";
    const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("support-attachments")
      .upload(path, attachment, { contentType: attachment.type, upsert: false });
    if (error) {
      toast.error("Falha ao enviar anexo.");
      return null;
    }
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

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("support-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["support-tickets-mine"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          if (payload.new?.ticket_id === selected) {
            qc.invalidateQueries({ queryKey: ["support-messages", selected] });
          }
          qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selected, qc]);

  // Mark read on open
  useEffect(() => {
    if (selected) {
      supabase.rpc("mark_support_ticket_read", { _ticket_id: selected }).then(() => {
        qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
        qc.invalidateQueries({ queryKey: ["unread-support"] });
      });
    }
  }, [selected, messages.length, qc]);

  // Scroll bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, selected]);

  const createTicket = async () => {
    if (!subject.trim() || !firstMsg.trim()) {
      toast.error("Preencha assunto e mensagem.");
      return;
    }
    setSending(true);
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user!.id, subject: subject.trim() })
      .select()
      .single();
    if (error || !t) { setSending(false); toast.error("Erro ao abrir ticket."); return; }
    await supabase.from("support_messages").insert({
      ticket_id: t.id, sender_id: user!.id, is_admin: false, body: firstMsg.trim(),
    });
    setSending(false);
    setNewOpen(false);
    setSubject(""); setFirstMsg("");
    setSelected(t.id);
    qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
    toast.success("Ticket aberto! Em breve um agente responderá.");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="h-8 w-8 shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Ajuda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Converse com nosso suporte em tempo real ou envie um e-mail.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-2 ml-auto">
          <Plus className="h-4 w-4" /> Novo chamado
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3 text-sm">
        <Mail className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Prefere e-mail?</span>
        <a href="mailto:suporte@vitrapay.com.br" className="text-primary hover:underline font-medium">
          suporte@vitrapay.com.br
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-[60vh]">
        {/* List */}
        <Card className={`border-border p-0 overflow-hidden ${selected ? "hidden md:block" : ""}`}>
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Seus chamados ({tickets.length})
            </p>
          </div>
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhum chamado ainda.
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition ${selected === t.id ? "bg-muted/40" : ""}`}
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

        {/* Chat */}
        <Card className={`border-border flex flex-col p-0 overflow-hidden ${!selected ? "hidden md:flex" : "flex"}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione um chamado para conversar.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9 shrink-0 bg-primary/10">
                  <AvatarImage src={vitrapayLogo} alt="VitraPay" className="object-contain p-1" />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">VP</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">VitraPay · Suporte</p>
                  <p className="text-[0.7rem] text-muted-foreground truncate">{ticket?.subject}</p>
                </div>
                <Badge variant="outline" className={`text-[0.6rem] ${statusMap[ticket?.status || "open"]?.cls}`}>
                  {statusMap[ticket?.status || "open"]?.label}
                </Badge>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background/30">
                {messages.map((m) => (
                  <div key={m.id} className={`flex items-end gap-2 ${m.is_admin ? "justify-start" : "justify-end"}`}>
                    {m.is_admin && (
                      <Avatar className="h-7 w-7 shrink-0 bg-primary/10">
                        <AvatarImage src={vitrapayLogo} alt="VitraPay" className="object-contain p-0.5" />
                        <AvatarFallback className="text-[0.6rem] bg-primary text-primary-foreground">VP</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.is_admin ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                      {m.is_admin && (
                        <p className="text-[0.65rem] font-semibold text-primary mb-0.5">VitraPay</p>
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
                        {!m.is_admin && <CheckCheck className="h-3 w-3" />}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {ticketLocked ? (
                <div className="border-t border-border p-4 bg-muted/20 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Este chamado foi <span className="font-semibold">{statusMap[ticket!.status]?.label.toLowerCase()}</span> pelo suporte. Para continuar, abra um novo chamado.
                  </p>
                  <Button size="sm" onClick={() => setNewOpen(true)} className="gap-2">
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
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remover anexo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label
                      className="flex items-center justify-center h-auto px-3 rounded-md border border-input bg-background hover:bg-accent cursor-pointer shrink-0"
                      title="Anexar imagem ou PDF"
                    >
                      <Paperclip className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => pickAttachment(e.target.files?.[0] || null)}
                      />
                    </label>
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      rows={2}
                      className="resize-none"
                      lang="pt-BR"
                      spellCheck
                      autoCorrect="on"
                      autoCapitalize="sentences"
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
            </>
          )}
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Abrir novo chamado</DialogTitle>
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
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={createTicket} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Abrir chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
