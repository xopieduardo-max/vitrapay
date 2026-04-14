import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, AlertTriangle, Wrench, Banknote, Mail } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_fees")
        .select("maintenance_mode, withdrawal_fee, support_email, min_withdrawal_amount")
        .eq("id", 1)
        .single();
      return data;
    },
  });

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [withdrawalFee, setWithdrawalFee] = useState("5.00");
  const [minWithdrawal, setMinWithdrawal] = useState("20.00");
  const [supportEmail, setSupportEmail] = useState("suporte@vitrapay.com.br");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    setMaintenanceMode(config.maintenance_mode ?? false);
    setWithdrawalFee(((config.withdrawal_fee ?? 500) / 100).toFixed(2));
    setMinWithdrawal(((config.min_withdrawal_amount ?? 2000) / 100).toFixed(2));
    setSupportEmail(config.support_email ?? "suporte@vitrapay.com.br");
  }, [config]);

  const handleSave = async () => {
    const wFee = Math.round(parseFloat(withdrawalFee) * 100);
    const minW = Math.round(parseFloat(minWithdrawal) * 100);

    if (isNaN(wFee) || wFee < 0) {
      toast.error("Taxa de saque inválida.");
      return;
    }
    if (isNaN(minW) || minW < 100) {
      toast.error("Valor mínimo de saque deve ser pelo menos R$ 1,00.");
      return;
    }
    if (!supportEmail.includes("@")) {
      toast.error("Email de suporte inválido.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("platform_fees")
      .update({
        maintenance_mode: maintenanceMode,
        withdrawal_fee: wFee,
        min_withdrawal_amount: minW,
        support_email: supportEmail.trim(),
      } as any)
      .eq("id", 1);

    if (error) {
      toast.error("Erro ao salvar configurações.");
    } else {
      toast.success("Configurações salvas!");
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurações operacionais globais da VitraPay
        </p>
      </div>

      {/* Maintenance mode */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Modo de Manutenção</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Ativar modo de manutenção</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exibe um aviso para todos os usuários de que a plataforma está em manutenção.
              Somente admins conseguem acessar o painel.
            </p>
          </div>
          <Switch
            checked={maintenanceMode}
            onCheckedChange={setMaintenanceMode}
          />
        </div>
        {maintenanceMode && (
          <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Modo de manutenção ativo — usuários verão um aviso ao acessar a plataforma.
          </div>
        )}
      </div>

      {/* Withdrawal settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Configurações de Saque</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Taxa por saque (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={withdrawalFee}
              onChange={(e) => setWithdrawalFee(e.target.value)}
              placeholder="5.00"
              className="bg-muted/50 border-transparent focus:border-border"
            />
            <p className="text-xs text-muted-foreground">Atualmente: R$ 5,00 por saque</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Valor mínimo de saque (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              min="1"
              value={minWithdrawal}
              onChange={(e) => setMinWithdrawal(e.target.value)}
              placeholder="20.00"
              className="bg-muted/50 border-transparent focus:border-border"
            />
            <p className="text-xs text-muted-foreground">Valor mínimo que produtores podem sacar</p>
          </div>
        </div>
      </div>

      {/* Contact settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Contato e Suporte</h3>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Email de suporte
          </Label>
          <Input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="suporte@vitrapay.com.br"
            className="bg-muted/50 border-transparent focus:border-border"
          />
          <p className="text-xs text-muted-foreground">
            Exibido nos emails enviados pela plataforma
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
