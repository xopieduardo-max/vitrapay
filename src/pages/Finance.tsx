import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Wallet, ArrowDownToLine, ArrowUpRight, TrendingUp, Clock, Loader2, DollarSign,
} from "lucide-react";

export default function Finance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<string>("cpf");

  // Get sales for balance calc
  const { data: sales = [] } = useQuery({
    queryKey: ["my-sales", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("amount, platform_fee, status, created_at")
        .eq("producer_id", user.id)
        .eq("status", "completed");
      return data || [];
    },
    enabled: !!user,
  });

  // Get commissions earned as affiliate
  const { data: commissions = [] } = useQuery({
    queryKey: ["my-commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("commissions")
        .select("amount, status, created_at")
        .eq("affiliate_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Get withdrawals
  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ["withdrawals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Valor inválido");
      if (amountCents > availableBalance) throw new Error("Saldo insuficiente");
      if (!pixKey.trim()) throw new Error("Informe a chave Pix");

      const { error } = await supabase.from("withdrawals").insert({
        user_id: user.id,
        amount: amountCents,
        pix_key: pixKey.trim(),
        pix_key_type: pixKeyType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saque solicitado!", description: "Processaremos em até 24h." });
      setWithdrawOpen(false);
      setAmount("");
      setPixKey("");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const totalSales = sales.reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);
  const totalCommissions = commissions.reduce((acc, c) => acc + c.amount, 0);
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((acc, w) => acc + w.amount, 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((acc, w) => acc + w.amount, 0);
  const availableBalance = totalSales + totalCommissions - totalWithdrawn - pendingWithdrawals;

  const statusColors: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    processing: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-accent/10 text-accent border-accent/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    completed: "Concluído",
    rejected: "Rejeitado",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-title">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus ganhos e saques</p>
        </div>
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <ArrowDownToLine className="h-4 w-4" strokeWidth={1.5} />
              Solicitar Saque
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Saque via Pix</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground">Saldo disponível</p>
                <p className="text-2xl font-bold text-primary">
                  R$ {(availableBalance / 100).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Valor do saque (R$)</Label>
                <Input
                  placeholder="100,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de chave Pix</Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave Pix</Label>
                <Input
                  placeholder="Sua chave Pix"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={requestWithdrawal.isPending}
                onClick={() => requestWithdrawal.mutate()}
              >
                {requestWithdrawal.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar Saque"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Saldo Disponível", value: availableBalance, icon: Wallet, color: "text-primary" },
          { label: "Total em Vendas", value: totalSales, icon: TrendingUp, color: "text-accent" },
          { label: "Comissões", value: totalCommissions, icon: ArrowUpRight, color: "text-warning" },
          { label: "Total Sacado", value: totalWithdrawn, icon: DollarSign, color: "text-muted-foreground" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="rounded-lg border border-border bg-card p-4 space-y-1"
          >
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-xl font-bold stat-value ${stat.color}`}>
              R$ {(stat.value / 100).toFixed(2)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Withdrawal history */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Histórico de Saques</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum saque realizado ainda.
          </div>
        ) : (
          <div>
            {withdrawals.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium">
                      R$ {(w.amount / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {w.pix_key_type?.toUpperCase()} • {new Date(w.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[0.6rem] ${statusColors[w.status]}`}>
                  {statusLabels[w.status] || w.status}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
