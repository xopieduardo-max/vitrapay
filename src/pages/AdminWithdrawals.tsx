import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowDownToLine, Loader2, CheckCircle2, XCircle, User, Banknote,
} from "lucide-react";

const WITHDRAWAL_FEE = 500;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-accent/10 text-accent border-accent/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  completed: "Aprovado",
  rejected: "Rejeitado",
};

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const userIds = [...new Set(withdrawals.map((w) => w.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["withdrawal-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.display_name]));

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed" || status === "rejected") {
        updates.processed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("withdrawals").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const payWithPix = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const { data, error } = await supabase.functions.invoke("process-withdrawal", {
        body: { withdrawal_id: withdrawalId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error + (data.details ? `: ${data.details}` : ""));
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "PIX enviado com sucesso!",
        description: `Transfer ID: ${data.transfer_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao enviar PIX",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  const pending = withdrawals.filter((w) => w.status === "pending" || w.status === "processing");
  const history = withdrawals.filter((w) => w.status === "completed" || w.status === "rejected");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprovação de Saques</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pending.length} saque(s) pendente(s) de aprovação
        </p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Pendentes
          </h2>
          {pending.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profileMap[w.user_id] || "Usuário"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {w.pix_key_type?.toUpperCase()}: {w.pix_key}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-bold">R$ {(w.amount / 100).toFixed(2)}</p>
                  <p className="text-[0.6rem] text-muted-foreground">
                    Taxa: R$ {(WITHDRAWAL_FEE / 100).toFixed(2)} •{" "}
                    {new Date(w.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[0.6rem] ${statusColors[w.status]}`}>
                  {statusLabels[w.status]}
                </Badge>
              </div>

              <div className="flex items-center gap-2 sm:ml-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={payWithPix.isPending || !w.pix_key}
                  onClick={() => payWithPix.mutate(w.id)}
                >
                  {payWithPix.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Banknote className="h-3.5 w-3.5" />
                  )}
                  Pagar PIX
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: w.id, status: "completed" })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Manual
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive border-destructive/30"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: w.id, status: "rejected" })}
                >
                  <XCircle className="h-3.5 w-3.5" /> Rejeitar
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Histórico</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum saque processado ainda.
          </div>
        ) : (
          <div>
            {history.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium">
                      {profileMap[w.user_id] || "Usuário"} — R$ {(w.amount / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {w.pix_key_type?.toUpperCase()} • Processado em{" "}
                      {w.processed_at
                        ? new Date(w.processed_at).toLocaleDateString("pt-BR")
                        : "—"}
                      {(w as any).transfer_id && (
                        <span className="ml-2 text-primary">
                          • Transfer: {(w as any).transfer_id.substring(0, 12)}…
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[0.6rem] ${statusColors[w.status]}`}>
                  {statusLabels[w.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
