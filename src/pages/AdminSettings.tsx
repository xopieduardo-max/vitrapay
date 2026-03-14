import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Configurações da plataforma</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div>
          <h3 className="font-semibold text-sm tracking-title mb-4">Taxa da Plataforma</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-label text-muted-foreground">Taxa sobre vendas (%)</Label>
              <Input type="number" defaultValue="10" className="bg-muted/50 border-transparent focus:border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-label text-muted-foreground">Taxa fixa por transação (R$)</Label>
              <Input type="number" defaultValue="1.50" step="0.01" className="bg-muted/50 border-transparent focus:border-border" />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-sm tracking-title mb-4">Gateways de Pagamento</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-label text-muted-foreground">Chave Stripe</Label>
              <Input placeholder="sk_live_..." className="bg-muted/50 border-transparent focus:border-border font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-label text-muted-foreground">Token Mercado Pago</Label>
              <Input placeholder="APP_USR-..." className="bg-muted/50 border-transparent focus:border-border font-mono text-xs" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button>Salvar Configurações</Button>
        </div>
      </div>
    </div>
  );
}
