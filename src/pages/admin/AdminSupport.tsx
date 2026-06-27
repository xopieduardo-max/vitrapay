import { useEffect, useRef, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Send, Loader2, Search, ArrowLeft, CheckCheck, Paperclip, X, MoreVertical, Pencil, Trash2, UserCog, Star } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SupportAttachment } from "@/components/support/SupportAttachment";
import { convertImageToWebp, getImageFromClipboard } from "@/lib/toWebp";
import { useAssistantAvatars } from "@/hooks/useAssistantAvatars";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { QuickRepliesPopover } from "@/components/admin/QuickRepliesPopover";

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5 align-middle">
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
import { Link } from "react-router-dom";

const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  last_message_at: string;
  unread_for_admin: number;
  created_at: string;
  rating?: number | null;
  rating_comment?: string | null;
  rated_at?: string | null;
}

const statusMap: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  pending: { label: "Em atendimento", cls: "bg-green-500/10 text-green-600 border-green-500/30" },
  resolved: { label: "Resolvido", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  closed: { label: "Finalizado", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
};

const QUICK_TABS: { key: "all" | "open" | "pending" | "resolved" | "closed"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "open", label: "Aberto" },
  { key: "pending", label: "Em atendimento" },
  { key: "resolved", label: "Resolvido" },
  { key: "closed", label: "Finalizado" },
];

const LOCKED_STATUSES = new Set(["resolved", "closed"]);

function initials(name?: string) {
  if (!name) return "U";
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}


export default function AdminSupport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "pending" | "resolved" | "closed">("all");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string>(() => localStorage.getItem("admin_active_assistant") || "");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: assistants = [] } = useQuery({
    queryKey: ["active-assistants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_assistants")
        .select("id, name, role_label, avatar_url")
        .eq("active", true)
        .order("sort_order");
      return data || [];
    },
  });

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

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Ticket[];
    },
  });

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length, open: 0, pending: 0, resolved: 0, closed: 0 };
    tickets.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [tickets]);

  const { data: profiles = {} } = useQuery({
    queryKey: ["admin-support-profiles", tickets.map((t) => t.user_id).join(",")],
    enabled: tickets.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(tickets.map((t) => t.user_id)));
      const [{ data: profs }, { data: emails }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids),
        supabase.rpc("get_user_emails"),
      ]);
      const map: Record<string, { name: string; email: string; avatar: string | null }> = {};
      (profs || []).forEach((p: any) => {
        map[p.user_id] = { name: p.display_name || "Usuário", email: "", avatar: p.avatar_url };
      });
      (emails || []).forEach((e: any) => {
        if (map[e.user_id]) map[e.user_id].email = e.email;
        else map[e.user_id] = { name: "Usuário", email: e.email, avatar: null };
      });
      return map;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-support-messages", selected],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selected!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selected,
  });

  useEffect(() => {
    const channel = supabase
      .channel("support-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" },
        () => qc.invalidateQueries({ queryKey: ["admin-support-tickets"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" },
        (payload: any) => {
          const tid = (payload.new as any)?.ticket_id || (payload.old as any)?.ticket_id;
          if (tid === selected) {
            qc.invalidateQueries({ queryKey: ["admin-support-messages", selected] });
          }
          qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected, qc]);

  useEffect(() => {
    if (selected) {
      supabase.rpc("mark_support_ticket_read", { _ticket_id: selected }).then(() => {
        qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        qc.invalidateQueries({ queryKey: ["admin-sidebar-counters"] });
      });
      // Auto: ao abrir um chamado "Aberto", muda para "Pendente" (em atendimento)
      const t = tickets.find((x) => x.id === selected);
      if (t?.status === "open") {
        supabase.from("support_tickets").update({ status: "pending" }).eq("id", selected).then(() => {
          qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        });
      }
    }
  }, [selected, messages.length, tickets, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, selected]);

  const filtered = useMemo(() => {
    let t = tickets;
    if (filter !== "all") t = t.filter((x) => x.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      t = t.filter((x) => {
        const p = (profiles as any)[x.user_id];
        return x.subject.toLowerCase().includes(q) ||
          p?.name?.toLowerCase().includes(q) ||
          p?.email?.toLowerCase().includes(q);
      });
    }
    return t;
  }, [tickets, filter, search, profiles]);

  const send = async () => {
    if ((!reply.trim() && !attachment) || !selected) return;
    const t = tickets.find((x) => x.id === selected);
    if (t && LOCKED_STATUSES.has(t.status)) {
      toast.error("Este chamado está encerrado. Reabra mudando o status para Pendente.");
      return;
    }
    setSending(true);
    const body = reply.trim();
    let uploaded: { path: string; name: string; type: string } | null = null;
    if (attachment) {
      const ext = attachment.name.split(".").pop() || "bin";
      const path = `${selected}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("support-attachments")
        .upload(path, attachment, { contentType: attachment.type, upsert: false });
      if (upErr) { setSending(false); toast.error("Falha ao enviar anexo."); return; }
      uploaded = { path, name: attachment.name, type: attachment.type };
    }
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected,
      sender_id: user!.id,
      is_admin: true,
      body: body || null,
      attachment_url: uploaded?.path ?? null,
      attachment_name: uploaded?.name ?? null,
      attachment_type: uploaded?.type ?? null,
      assistant_id: assistantId || null,
    } as any);
    setSending(false);
    if (error) { toast.error("Erro ao enviar."); return; }
    setReply("");
    setAttachment(null);
    notifyStop();
    qc.invalidateQueries({ queryKey: ["admin-support-messages", selected] });

    if (t) {
      if (t.status === "open") {
        supabase.from("support_tickets").update({ status: "pending" }).eq("id", t.id);
      }
      const pushBody = body || (uploaded ? `📎 ${uploaded.name}` : "Nova mensagem");
      const activeAssistant = assistants.find((a: any) => a.id === assistantId);
      const pushTitle = activeAssistant ? `${activeAssistant.name} respondeu` : "Suporte VitraPay respondeu";
      supabase.functions.invoke("send-push", {
        body: {
          producer_id: t.user_id,
          title: pushTitle,
          body: pushBody.length > 80 ? pushBody.slice(0, 80) + "…" : pushBody,
          url: "/support",
        },
      }).catch(() => {});
    }
  };

  const setStatus = async (status: string) => {
    if (!selected) return;
    await supabase.from("support_tickets").update({ status }).eq("id", selected);
    qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    toast.success("Status atualizado");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) { toast.error("Mensagem não pode ficar vazia."); return; }
    setEditSaving(true);
    const { error } = await supabase
      .from("support_messages")
      .update({ body, edited_at: new Date().toISOString() } as any)
      .eq("id", editing.id);
    setEditSaving(false);
    if (error) { toast.error("Erro ao editar mensagem."); return; }
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-support-messages", selected] });
    toast.success("Mensagem editada");
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting;
    setDeleting(null);
    // Remove o anexo do storage também, se existir
    const msg: any = messages.find((m: any) => m.id === id);
    if (msg?.attachment_url) {
      supabase.storage.from("support-attachments").remove([msg.attachment_url]).catch(() => {});
    }
    const { error } = await supabase.from("support_messages").delete().eq("id", id);
    if (error) { toast.error("Erro ao apagar mensagem."); return; }
    qc.invalidateQueries({ queryKey: ["admin-support-messages", selected] });
    toast.success("Mensagem apagada");
  };

  const ticket = tickets.find((t) => t.id === selected);
  const ticketUser = ticket ? (profiles as any)[ticket.user_id] : null;
  const totalUnread = tickets.reduce((a, t) => a + (t.unread_for_admin || 0), 0);
  const activeAssistant = assistants.find((a: any) => a.id === assistantId);
  const assistantAvatars = useAssistantAvatars(assistants.map((a: any) => a.avatar_url));

  const ticketLocked = ticket && LOCKED_STATUSES.has(ticket.status);
  const { isOtherTyping, notifyTyping, notifyStop } = useTypingIndicator({
    ticketId: selected,
    isAdmin: true,
    enabled: !!selected && !ticketLocked,
  });

  useEffect(() => {
    if (assistantId) localStorage.setItem("admin_active_assistant", assistantId);
    else localStorage.removeItem("admin_active_assistant");
  }, [assistantId]);

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)] md:h-[calc(100dvh-7rem)]">
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Mensagens
          {totalUnread > 0 && (
            <span className="text-sm bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {totalUnread}
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 hidden md:block">
          Atenda chamados de produtores e compradores em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 flex-1 min-h-0">
        <Card className={`border-border p-0 overflow-hidden flex-col min-h-0 ${selected ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`text-[0.7rem] px-2 py-1 rounded-full border transition ${
                    filter === tab.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1 ${filter === tab.key ? "opacity-90" : "opacity-60"}`}>
                    {statusCounts[tab.key] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhum chamado.
            </div>
          ) : (
            <div className="divide-y divide-border overflow-y-auto flex-1">
              {filtered.map((t) => {
                const p = (profiles as any)[t.user_id];
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    className={`w-full text-left px-3 py-3 hover:bg-muted/30 transition flex gap-3 ${selected === t.id ? "bg-muted/40" : ""}`}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {p?.avatar && <AvatarImage src={p.avatar} alt={p?.name} />}
                      <AvatarFallback className="text-xs">{initials(p?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium truncate flex-1">{t.subject}</p>
                        {t.unread_for_admin > 0 && (
                          <span className="text-[0.6rem] bg-primary text-primary-foreground rounded-full px-1.5 min-w-[18px] text-center">
                            {t.unread_for_admin}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {p?.name || "—"} · {p?.email || ""}
                      </p>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <Badge variant="outline" className={`text-[0.6rem] ${statusMap[t.status]?.cls}`}>
                          {statusMap[t.status]?.label}
                        </Badge>
                        <span className="text-muted-foreground">
                          {format(new Date(t.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className={`border-border flex-col p-0 overflow-hidden min-h-0 ${!selected ? "hidden md:flex" : "flex"}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione um chamado.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden h-7 w-7" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9 shrink-0">
                  {ticketUser?.avatar && <AvatarImage src={ticketUser.avatar} alt={ticketUser?.name} />}
                  <AvatarFallback className="text-xs">{initials(ticketUser?.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{ticket?.subject}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {isOtherTyping ? (
                      <span className="text-primary font-medium flex items-center">
                        {ticketUser?.name || "Cliente"} está digitando<TypingDots />
                      </span>
                    ) : (
                      <>{ticketUser?.name} · {ticketUser?.email}</>
                    )}
                  </p>
                </div>
                <Select value={ticket?.status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                    <SelectItem value="closed">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background/30">
                {messages.map((m: any) => {
                  const asst = m.is_admin && m.assistant_id ? assistants.find((a: any) => a.id === m.assistant_id) : null;
                  const asstAvatar = asst?.avatar_url ? assistantAvatars[asst.avatar_url] : "";
                  return (
                  <div key={m.id} className={`group flex items-end gap-1.5 ${m.is_admin ? "justify-end" : "justify-start"}`}>
                    {m.is_admin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 transition mb-1 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                            aria-label="Ações da mensagem"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          {m.body && (
                            <DropdownMenuItem onClick={() => setEditing({ id: m.id, body: m.body || "" })}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setDeleting(m.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.is_admin ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {asst && (
                        <p className="text-[0.65rem] font-semibold opacity-90 mb-0.5">
                          {asst.name}{asst.role_label ? ` · ${asst.role_label}` : ""}
                        </p>
                      )}
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      {m.attachment_url && (
                        <SupportAttachment
                          path={m.attachment_url}
                          name={m.attachment_name}
                          type={m.attachment_type}
                          ownBubble={m.is_admin}
                        />
                      )}
                      <p className="text-[0.6rem] opacity-70 mt-1 flex items-center gap-1">
                        {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        {m.edited_at && <span className="italic">· editada</span>}
                        {m.is_admin && <CheckCheck className="h-3 w-3" />}
                      </p>
                    </div>
                    {m.is_admin && asst && (
                      <Avatar className="h-7 w-7 shrink-0">
                        {asstAvatar && <AvatarImage src={asstAvatar} alt={asst.name} />}
                        <AvatarFallback className="text-[0.6rem] bg-primary/15 text-primary">{initials(asst.name)}</AvatarFallback>
                      </Avatar>
                    )}
                    {!m.is_admin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 transition mb-1 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                            aria-label="Ações da mensagem"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-36">
                          <DropdownMenuItem onClick={() => setDeleting(m.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  );
                })}
              </div>
              {ticket && LOCKED_STATUSES.has(ticket.status) ? (
                <div className="border-t border-border p-4 text-center text-xs text-muted-foreground bg-muted/20">
                  Chamado <span className="font-semibold">{statusMap[ticket.status]?.label.toLowerCase()}</span>. Para responder novamente, mude o status para <span className="font-semibold">Pendente</span>.
                </div>
              ) : (
                <div className="border-t border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar className="h-7 w-7 shrink-0">
                        {activeAssistant?.avatar_url && (
                          <AvatarImage src={assistantAvatars[activeAssistant.avatar_url] || ""} alt={activeAssistant.name} />
                        )}
                        <AvatarFallback className="text-[0.6rem] bg-primary/15 text-primary">
                          {activeAssistant ? initials(activeAssistant.name) : <UserCog className="h-3.5 w-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                      <Select value={assistantId || "none"} onValueChange={(v) => setAssistantId(v === "none" ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Responder como..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Suporte VitraPay (padrão)</SelectItem>
                          {assistants.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}{a.role_label ? ` · ${a.role_label}` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {assistants.length === 0 && (
                      <Link to="/admin/assistants" className="text-[0.65rem] text-primary hover:underline whitespace-nowrap">
                        + Criar atendente
                      </Link>
                    )}
                  </div>
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
                  <div className="flex gap-2 relative">
                    <label className="flex items-center justify-center h-auto px-3 rounded-md border border-input bg-background hover:bg-accent cursor-pointer shrink-0" title="Anexar imagem ou PDF">
                      <Paperclip className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => pickAttachment(e.target.files?.[0] || null)}
                      />
                    </label>
                    {(() => {
                      const trimmed = reply.trimStart();
                      const m = /^\/([^\s\n]*)$/.exec(trimmed);
                      const quickOpen = !!m;
                      const quickQuery = m?.[1] ?? "";
                      return (
                        <div className="flex-1 relative">
                          <QuickRepliesPopover
                            open={quickOpen}
                            query={quickQuery}
                            onSelect={(body) => setReply(body)}
                            onClose={() => setReply("")}
                          />
                          <Textarea
                            value={reply}
                            onChange={(e) => { setReply(e.target.value); notifyTyping(); }}
                            placeholder='Resposta do suporte... (digite "/" para respostas rápidas)'
                            rows={2}
                            className="resize-none w-full"
                            lang="pt-BR"
                            spellCheck
                            autoCorrect="on"
                            autoCapitalize="sentences"
                            onPaste={handlePaste}
                            onKeyDown={(e) => {
                              if (quickOpen && ["Enter", "ArrowUp", "ArrowDown", "Tab", "Escape"].includes(e.key)) {
                                return;
                              }
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                            }}
                          />
                        </div>
                      );
                    })()}
                    <Button onClick={send} disabled={sending || (!reply.trim() && !attachment)}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editing?.body || ""}
            onChange={(e) => setEditing(editing ? { ...editing, body: e.target.value } : null)}
            rows={5}
            className="resize-none"
            lang="pt-BR"
            spellCheck
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem será removida do chat para você e para o cliente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
