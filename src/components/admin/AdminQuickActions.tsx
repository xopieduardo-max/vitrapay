import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MessageSquare, KeyRound, Banknote, Zap } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  userEmail?: string | null;
  userPhone?: string | null;
}

export function AdminQuickActions({ userId, userEmail, userPhone }: Props) {
  const qc = useQueryClient();
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");

  // Pending withdrawals for this user
  const { data: pendingWithdrawals = [] } = useQuery({
    queryKey: ["admin-user-pending-wd", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("id, amount, status, created_at")
        .eq("user_id", userId)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!msgText.trim()) throw new Error("Mensagem vazia");
      // Get or create open ticket for this user
      const { data: existing } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["open", "pending"])
        .order("last_message_at", { ascending: false })
        .limit(1);

      let ticketId = existing?.[0]?.id as string | undefined;

      if (!ticketId) {
        const { data: created, error } = await supabase
          .from("support_tickets")
          .insert({
            user_id: userId,
            subject: "Mensagem do administrador",
            status: "pending",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        ticketId = (created as any).id;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error: msgErr } = await supabase.from("support_messages").insert({
        ticket_id: ticketId,
        author_id: user?.id,
        is_admin: true,
        content: msgText.trim(),
      } as any);
      if (msgErr) throw msgErr;
    },
    onSuccess: () => {
      toast.success("Mensagem enviada ao usuário.");
      setMsgText("");
      setMsgOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar mensagem"),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!userEmail) throw new Error("Usuário sem e-mail cadastrado");
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("E-mail de reset de senha enviado."),
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar reset"),
  });

  const releaseWithdrawal = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const { data, error } = await supabase.functions.invoke("process-withdrawal", {
        body: { withdrawal_id: withdrawalId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Saque processado.");
      qc.invalidateQueries({ queryKey: ["admin-user-pending-wd", userId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao processar saque"),
  });

  const waLink = (() => {
    if (!userPhone) return null;
    const digits = String(userPhone).replace(/\D/g, "");
    if (digits.length < 10) return null;
    return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
  })();

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" strokeWidth={1.5} />
          Ações rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setMsgOpen(true)} className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Enviar mensagem
        </Button>

        {waLink ? (
          <Button size="sm" variant="outline" asChild className="gap-1.5">
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-green-500" aria-hidden="true">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607z" />
              </svg>
              WhatsApp
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled className="gap-1.5">
            WhatsApp (sem telefone)
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => resetPassword.mutate()}
          disabled={resetPassword.isPending || !userEmail}
          className="gap-1.5"
        >
          {resetPassword.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <KeyRound className="h-3.5 w-3.5" />
          )}
          Resetar senha
        </Button>

        {pendingWithdrawals.length > 0 ? (
          <Button
            size="sm"
            variant="default"
            onClick={() => releaseWithdrawal.mutate(pendingWithdrawals[0].id)}
            disabled={releaseWithdrawal.isPending}
            className="gap-1.5"
          >
            {releaseWithdrawal.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Banknote className="h-3.5 w-3.5" />
            )}
            Liberar saque ({pendingWithdrawals.length})
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled className="gap-1.5">
            <Banknote className="h-3.5 w-3.5" /> Sem saques pendentes
          </Button>
        )}
      </CardContent>

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem ao usuário</DialogTitle>
            <DialogDescription>
              A mensagem aparece na conversa de suporte do usuário (Ajuda & Suporte).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Escreva sua mensagem..."
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            rows={6}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)} disabled={sendMessage.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending || !msgText.trim()}>
              {sendMessage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
