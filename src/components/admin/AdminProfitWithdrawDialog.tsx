import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Banknote, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableProfit: number; // centavos
  source?: "platform" | "service-fee" | "withdrawal-fee";
}

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const sourceLabels = {
  platform: { title: "Sacar Lucro da Plataforma", label: "Lucro disponível", category: "admin-withdrawal" },
  "service-fee": { title: "Sacar Taxa de Serviço", label: "Taxa de serviço disponível", category: "admin-service-fee-withdrawal" },
  "withdrawal-fee": { title: "Sacar Taxa de Saque", label: "Taxa de saque disponível", category: "admin-withdrawal-fee-withdrawal" },
};

export default function AdminProfitWithdrawDialog({
  open,
  onOpenChange,
  availableProfit,
  source = "platform",
}: Props) {
  const labels = sourceLabels[source];
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pixKey, setPixKey] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { data, error } = await supabase.functions.invoke(
        "admin-withdraw",
        { body: { amount, pix_key: pixKey, withdrawal_category: labels.category } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Saque realizado!",
        description: `Transfer ID: ${data.transfer_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-all-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats-v2"] });
      onOpenChange(false);
      setPixKey("");
      setCustomAmount("");
    },
    onError: (err: any) => {
      toast({
        title: "Erro no saque",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const amountToWithdraw = customAmount
    ? Math.round(parseFloat(customAmount.replace(",", ".")) * 100)
    : availableProfit;

  const isValid =
    pixKey.length >= 5 &&
    amountToWithdraw > 0 &&
    amountToWithdraw <= availableProfit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>
            Transfira o lucro acumulado para sua conta via PIX
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{labels.label}</p>
            <p className="text-2xl font-bold text-primary">
              {fmt(availableProfit)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor do saque (deixe vazio para sacar tudo)</Label>
            <Input
              id="amount"
              placeholder={`Máx: ${(availableProfit / 100).toFixed(2)}`}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
            {customAmount && amountToWithdraw > availableProfit && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Valor excede o lucro disponível
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix">Chave PIX</Label>
            <Input
              id="pix"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs text-warning">
              ⚠️ Esse valor será transferido imediatamente via Asaas para a chave PIX informada.
            </p>
          </div>

          <Button
            className="w-full"
            disabled={!isValid || withdrawMutation.isPending}
            onClick={() => withdrawMutation.mutate(amountToWithdraw)}
          >
            {withdrawMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Banknote className="h-4 w-4 mr-2" />
            )}
            Sacar {fmt(amountToWithdraw)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
