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
import { MessageSquare, Send, Loader2, Search, ArrowLeft, CheckCheck } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  last_message_at: string;
  unread_for_admin: number;
  created_at: string;
}

const statusMap: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  pending: { label: "Respondido", cls: "bg-green-500/10 text-green-600 border-green-500/30" },
  resolved: { label: "Resolvido", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  closed: { label: "Fechado", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
};

function initials(name?: string) {
  if (!name) return "U";
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

export default function AdminSupport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "pending" | "resolved" | "closed">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Ticket[];
    },
  });

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          if (payload.new?.ticket_id === selected) {
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
    }
  }, [selected, messages.length, qc]);

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
    if (!reply.trim() || !selected) return;
    setSending(true);
    const body = reply.trim();
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected, sender_id: user!.id, is_admin: true, body,
    });
    setSending(false);
    if (error) { toast.error("Erro ao enviar."); return; }
    setReply("");
    qc.invalidateQueries({ queryKey: ["admin-support-messages", selected] });

    // Auto status -> pending (respondido) e push notification para o usuário
    const t = tickets.find((x) => x.id === selected);
    if (t) {
      if (t.status === "open") {
        supabase.from("support_tickets").update({ status: "pending" }).eq("id", t.id);
      }
      supabase.functions.invoke("send-push", {
        body: {
          producer_id: t.user_id,
          title: "Suporte VitraPay respondeu",
          body: body.length > 80 ? body.slice(0, 80) + "…" : body,
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

  const ticket = tickets.find((t) => t.id === selected);
  const ticketUser = ticket ? (profiles as any)[ticket.user_id] : null;
  const totalUnread = tickets.reduce((a, t) => a + (t.unread_for_admin || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Mensagens
          {totalUnread > 0 && (
            <span className="text-sm bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {totalUnread}
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atenda chamados de produtores e compradores em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 min-h-[70vh]">
        <Card className={`border-border p-0 overflow-hidden flex flex-col ${selected ? "hidden md:flex" : "flex"}`}>
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
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="pending">Respondidos</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
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

        <Card className={`border-border flex flex-col p-0 overflow-hidden ${!selected ? "hidden md:flex" : "flex"}`}>
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
                  <p className="text-xs text-muted-foreground truncate">
                    {ticketUser?.name} · {ticketUser?.email}
                  </p>
                </div>
                <Select value={ticket?.status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="pending">Respondido</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background/30">
                {messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.is_admin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.is_admin ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="text-[0.6rem] opacity-70 mt-1 flex items-center gap-1">
                        {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        {m.is_admin && <CheckCheck className="h-3 w-3" />}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Resposta do suporte..."
                  rows={2}
                  className="resize-none"
                  lang="pt-BR"
                  spellCheck
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                />
                <Button onClick={send} disabled={sending || !reply.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
