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
import { Loader2, Banknote, AlertTriangle, TrendingUp, Receipt, ArrowDownLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformAvailable: number;
  serviceFeeAvailable: number;
  withdrawalFeeAvailable: number;
}

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AdminCombinedWithdrawDialog({
  open,
  onOpenChange,
  platformAvailable,
  serviceFeeAvailable,
  withdrawalFeeAvailable,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pixKey, setPixKey] = useState("");
  const [platformAmount, setPlatformAmount] = useState("");
  const [serviceAmount, setServiceAmount] = useState("");
  const [withdrawalFeeAmount, setWithdrawalFeeAmount] = useState("");

  const parseAmount = (v: string) =>
    v.trim() ? Math.round(parseFloat(v.replace(",", ".")) * 100) : 0;

  const pAmt = parseAmount(platformAmount);
  const sAmt = parseAmount(serviceAmount);
  const wAmt = parseAmount(withdrawalFeeAmount);
  const totalToWithdraw = pAmt + sAmt + wAmt;

  const hasAnyAmount = pAmt > 0 || sAmt > 0 || wAmt > 0;
  const platformValid = pAmt === 0 || pAmt <= platformAvailable;
  const serviceValid = sAmt === 0 || sAmt <= serviceFeeAvailable;
  const withdrawalValid = wAmt === 0 || wAmt <= withdrawalFeeAvailable;
  const isValid = pixKey.length >= 5 && hasAnyAmount && platformValid && serviceValid && withdrawalValid;

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const calls: Promise<any>[] = [];

      if (pAmt > 0) {
        calls.push(
          supabase.functions.invoke("admin-withdraw", {
            body: { amount: pAmt, pix_key: pixKey, withdrawal_category: "admin-withdrawal" },
          })
        );
      }
      if (sAmt > 0) {
        calls.push(
          supabase.functions.invoke("admin-withdraw", {
            body: { amount: sAmt, pix_key: pixKey, withdrawal_category: "admin-service-fee-withdrawal" },
          })
        );
      }
      if (wAmt > 0) {
        calls.push(
          supabase.functions.invoke("admin-withdraw", {
            body: { amount: wAmt, pix_key: pixKey, withdrawal_category: "admin-withdrawal-fee-withdrawal" },
          })
        );
      }

      const results = await Promise.all(calls);
      for (const r of results) {
        if (r.error) throw r.error;
        if (r.data?.error) throw new Error(r.data.error);
      }
      return results;
    },
    onSuccess: () => {
      toast({ title: "Saques realizados com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats-v2"] });
      onOpenChange(false);
      setPixKey("");
      setPlatformAmount("");
      setServiceAmount("");
      setWithdrawalFeeAmount("");
    },
    onError: (err: any) => {
      toast({ title: "Erro no saque", description: err.message, variant: "destructive" });
    },
  });

  const sources = [
    {
      label: "Lucro da Plataforma",
      icon: TrendingUp,
      color: "text-primary",
      available: platformAvailable,
      value: platformAmount,
      onChange: setPlatformAmount,
      valid: platformValid,
    },
    {
      label: "Taxa de Serviço",
      icon: Receipt,
      color: "text-amber-500",
      available: serviceFeeAvailable,
      value: serviceAmount,
      onChange: setServiceAmount,
      valid: serviceValid,
    },
    {
      label: "Taxa de Saque",
      icon: ArrowDownLeft,
      color: "text-violet-500",
      available: withdrawalFeeAvailable,
      value: withdrawalFeeAmount,
      onChange: setWithdrawalFeeAmount,
      valid: withdrawalValid,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Sacar Taxas Acumuladas
          </DialogTitle>
          <DialogDescription>
            Defina o valor de cada fonte e saque tudo de uma vez via PIX
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {sources.map((src) => (
            <div key={src.label} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <src.icon className={`h-4 w-4 ${src.color}`} strokeWidth={1.5} />
                  <span className="text-xs font-medium">{src.label}</span>
                </div>
                <span className={`text-xs font-bold ${src.color}`}>
                  {fmt(Math.max(0, src.available))}
                </span>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={`Máx: ${(Math.max(0, src.available) / 100).toFixed(2)}`}
                value={src.value}
                onChange={(e) => src.onChange(e.target.value)}
                className="h-8 text-sm bg-card"
              />
              {!src.valid && (
                <p className="text-[0.65rem] text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Valor excede o disponível
                </p>
              )}
            </div>
          ))}

          {hasAnyAmount && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total do saque</span>
              <span className="text-lg font-bold text-primary">{fmt(totalToWithdraw)}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="combined-pix" className="text-xs">Chave PIX</Label>
            <Input
              id="combined-pix"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs text-warning">
              ⚠️ Cada valor será transferido separadamente via PIX para a chave informada.
            </p>
          </div>

          <Button
            className="w-full"
            disabled={!isValid || withdrawMutation.isPending}
            onClick={() => withdrawMutation.mutate()}
          >
            {withdrawMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Banknote className="h-4 w-4 mr-2" />
            )}
            Sacar {fmt(totalToWithdraw)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
