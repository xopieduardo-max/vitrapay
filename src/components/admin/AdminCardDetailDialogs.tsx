import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDownToLine,
  Banknote,
  ShoppingBag,
  Clock,
  Wallet,
  User,
} from "lucide-react";

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-accent/10 text-accent border-accent/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  completed: "Pago",
  rejected: "Rejeitado",
};

/* ── Admin Withdrawal History Dialog ── */
interface AdminWithdrawHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: any[];
  totalWithdrawn: number;
}

export function AdminWithdrawHistoryDialog({
  open,
  onOpenChange,
  transactions,
  totalWithdrawn,
}: AdminWithdrawHistoryProps) {
  const adminWithdrawals = transactions.filter(
    (t: any) =>
      t.category === "withdrawal" &&
      t.type === "debit" &&
      t.reference_id?.startsWith("admin")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            Histórico de Saques do Administrador
          </DialogTitle>
          <DialogDescription>
            Total sacado: <strong>{fmt(totalWithdrawn)}</strong>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {adminWithdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum saque realizado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {adminWithdrawals.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{fmt(t.amount)}</p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.6rem] text-muted-foreground">
                      {t.reference_id}
                    </p>
                    <Badge variant="outline" className="text-[0.55rem] bg-accent/10 text-accent border-accent/20">
                      Concluído
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ── Pending Withdrawals Detail Dialog ── */
interface PendingWithdrawalsDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawals: any[];
  profileMap: Record<string, string>;
}

export function PendingWithdrawalsDetailDialog({
  open,
  onOpenChange,
  withdrawals,
  profileMap,
}: PendingWithdrawalsDetailProps) {
  const pending = withdrawals.filter(
    (w: any) => w.status === "pending" || w.status === "processing"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Saques Pendentes dos Produtores
          </DialogTitle>
          <DialogDescription>
            Saques solicitados por produtores aguardando aprovação/pagamento
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum saque pendente.
            </p>
          ) : (
            <div className="space-y-2">
              {pending.map((w: any) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {profileMap[w.user_id] || "Usuário"}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        {w.pix_key_type?.toUpperCase()}: {w.pix_key} •{" "}
                        {new Date(w.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmt(w.amount)}</p>
                    <Badge
                      variant="outline"
                      className={`text-[0.55rem] ${statusColors[w.status]}`}
                    >
                      {statusLabels[w.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ── Total Paid Out Detail Dialog ── */
interface TotalPaidOutDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawals: any[];
  profileMap: Record<string, string>;
  totalPaidOut: number;
}

export function TotalPaidOutDetailDialog({
  open,
  onOpenChange,
  withdrawals,
  profileMap,
  totalPaidOut,
}: TotalPaidOutDetailProps) {
  const completed = withdrawals.filter((w: any) => w.status === "completed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent" />
            Total Pago aos Produtores
          </DialogTitle>
          <DialogDescription>
            Saques pagos aos produtores: <strong>{fmt(totalPaidOut)}</strong>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum saque pago ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {completed.map((w: any) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                      <Banknote className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {profileMap[w.user_id] || "Usuário"}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Pago em{" "}
                        {w.processed_at
                          ? new Date(w.processed_at).toLocaleDateString("pt-BR")
                          : new Date(w.created_at).toLocaleDateString("pt-BR")}
                        {w.transfer_id && (
                          <span className="ml-1 text-primary">
                            • {w.transfer_id.substring(0, 12)}…
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{fmt(w.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ── Pending Checkouts Detail Dialog ── */
interface PendingCheckoutsDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkouts: any[];
}

export function PendingCheckoutsDetailDialog({
  open,
  onOpenChange,
  checkouts,
}: PendingCheckoutsDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-warning" />
            Checkouts Pendentes
          </DialogTitle>
          <DialogDescription>
            Pagamentos iniciados (PIX gerado ou cartão pendente) que ainda não
            foram confirmados. Expiram automaticamente após o prazo do gateway.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {checkouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum checkout pendente no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {checkouts.map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {c.buyer_name || c.buyer_email || "Cliente"}
                    </p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {c.buyer_email && (
                        <span className="ml-1">• {c.buyer_email}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmt(c.amount)}</p>
                    <Badge
                      variant="outline"
                      className="text-[0.55rem] bg-warning/10 text-warning border-warning/20"
                    >
                      Aguardando
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
