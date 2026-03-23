import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown, Zap } from "lucide-react";

interface Props {
  productId: string;
  producerId: string;
}

export default function EditProductFunnel({ productId, producerId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [addingBump, setAddingBump] = useState(false);
  const [newStep, setNewStep] = useState({
    step_type: "upsell" as string,
    title: "",
    description: "",
    offer_product_id: "",
    discount_percentage: 0,
  });
  const [newBump, setNewBump] = useState({
    title: "9 A CADA 10 COMPRAM JUNTO...",
    description: "",
    bump_product_id: "",
    discount_percentage: 0,
  });

  const { data: funnelSteps = [], isLoading } = useQuery({
    queryKey: ["funnel-steps", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("funnel_steps")
        .select("*, offer_product:offer_product_id(id, title, price, cover_url)")
        .eq("product_id", productId)
        .order("position", { ascending: true });
      return data || [];
    },
    enabled: !!productId,
  });

  const { data: availableProducts = [] } = useQuery({
    queryKey: ["producer-products-for-funnel", producerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, title, price, cover_url")
        .eq("producer_id", producerId)
        .neq("id", productId);
      return data || [];
    },
    enabled: !!producerId,
  });

  const { data: orderBumps = [] } = useQuery({
    queryKey: ["order-bumps", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_bumps")
        .select("*, bump_product:bump_product_id(id, title, price, cover_url)")
        .eq("product_id", productId);
      return data || [];
    },
    enabled: !!productId,
  });

  const handleAdd = async () => {
    if (!newStep.title || !newStep.offer_product_id) {
      toast({ title: "Preencha título e selecione o produto da oferta", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from("funnel_steps").insert({
        product_id: productId,
        step_type: newStep.step_type,
        title: newStep.title,
        description: newStep.description || null,
        offer_product_id: newStep.offer_product_id,
        discount_percentage: newStep.discount_percentage,
        position: funnelSteps.length,
        is_active: true,
      });
      if (error) throw error;
      toast({ title: "Etapa de funil adicionada!" });
      setNewStep({ step_type: "upsell", title: "", description: "", offer_product_id: "", discount_percentage: 0 });
      queryClient.invalidateQueries({ queryKey: ["funnel-steps", productId] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("funnel_steps").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["funnel-steps", productId] });
    toast({ title: "Etapa removida" });
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("funnel_steps").update({ is_active: !isActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["funnel-steps", productId] });
  };

  const handleAddBump = async () => {
    if (!newBump.bump_product_id) {
      toast({ title: "Selecione o produto do order bump", variant: "destructive" });
      return;
    }

    setAddingBump(true);
    try {
      const selectedProduct = availableProducts.find((product: any) => product.id === newBump.bump_product_id);

      const { error } = await supabase.from("order_bumps").insert({
        product_id: productId,
        title: newBump.title,
        description: newBump.description || null,
        bump_product_id: newBump.bump_product_id,
        discount_percentage: newBump.discount_percentage,
        is_active: true,
      });

      if (error) throw error;

      toast({ title: "Order bump adicionado!" });
      setNewBump({
        title: `Adicione ${selectedProduct?.title || "este complemento"}`,
        description: "",
        bump_product_id: "",
        discount_percentage: 0,
      });
      queryClient.invalidateQueries({ queryKey: ["order-bumps", productId] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setAddingBump(false);
    }
  };

  const handleDeleteBump = async (id: string) => {
    await supabase.from("order_bumps").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["order-bumps", productId] });
    toast({ title: "Order bump removido" });
  };

  const handleToggleBump = async (id: string, isActive: boolean) => {
    await supabase.from("order_bumps").update({ is_active: !isActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["order-bumps", productId] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="text-sm font-bold">Como funciona hoje</h3>
        <p className="text-xs text-muted-foreground">
          <strong>Upsell e Downsell</strong> aparecem somente <strong>depois do pagamento aprovado</strong>. Para oferta <strong>antes do pagamento</strong>, use o <strong>Order Bump</strong> abaixo.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> Funil de Vendas (Upsell / Downsell)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure ofertas que aparecem após a compra do produto principal.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{funnelSteps.length} etapa(s)</span>
        </div>

        {/* Existing steps */}
        {funnelSteps.length > 0 && (
          <div className="space-y-2">
            {funnelSteps.map((step: any, idx: number) => (
              <div
                key={step.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                style={{ opacity: step.is_active ? 1 : 0.5 }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[0.6rem] font-bold text-muted-foreground">{idx + 1}</span>
                    {step.step_type === "upsell" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-orange-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{
                          background: step.step_type === "upsell" ? "hsl(142,71%,45%,0.15)" : "hsl(25,95%,53%,0.15)",
                          color: step.step_type === "upsell" ? "hsl(142,71%,45%)" : "hsl(25,95%,53%)",
                        }}
                      >
                        {step.step_type}
                      </span>
                      <p className="text-sm font-semibold truncate">{step.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.offer_product?.title || "Produto"} 
                      {step.discount_percentage > 0 && ` • ${step.discount_percentage}% OFF`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={step.is_active}
                    onCheckedChange={() => handleToggle(step.id, step.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(step.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new step */}
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground">Adicionar nova etapa</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={newStep.step_type} onValueChange={(v) => setNewStep((s) => ({ ...s, step_type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upsell">⬆️ Upsell (oferta mais cara)</SelectItem>
                  <SelectItem value="downsell">⬇️ Downsell (oferta mais barata)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título da oferta</Label>
              <Input
                value={newStep.title}
                onChange={(e) => setNewStep((s) => ({ ...s, title: e.target.value }))}
                placeholder="Ex: Upgrade para o plano completo!"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Produto da oferta</Label>
              <Select value={newStep.offer_product_id} onValueChange={(v) => setNewStep((s) => ({ ...s, offer_product_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} - R$ {(p.price / 100).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desconto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={newStep.discount_percentage}
                onChange={(e) => setNewStep((s) => ({ ...s, discount_percentage: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={newStep.description}
              onChange={(e) => setNewStep((s) => ({ ...s, description: e.target.value }))}
              placeholder="Garanta o acesso VITALÍCIO + ATUALIZAÇÕES..."
              rows={2}
              className="mt-1"
            />
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleAdd} disabled={adding}>
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar Etapa
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Order Bump (antes do pagamento)</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Esse bloco aparece dentro do checkout, antes do cliente finalizar a compra.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{orderBumps.length} bump(s)</span>
        </div>

        {orderBumps.length > 0 && (
          <div className="space-y-2">
            {orderBumps.map((bump: any) => (
              <div
                key={bump.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                style={{ opacity: bump.is_active ? 1 : 0.5 }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {bump.bump_product?.cover_url ? (
                    <img src={bump.bump_product.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{bump.title || bump.bump_product?.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {bump.bump_product?.title || "Produto"}
                      {bump.discount_percentage > 0 && ` • ${bump.discount_percentage}% OFF`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={bump.is_active}
                    onCheckedChange={() => handleToggleBump(bump.id, bump.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteBump(bump.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground">Adicionar novo order bump</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Título do bloco</Label>
              <Input
                value={newBump.title}
                onChange={(e) => setNewBump((s) => ({ ...s, title: e.target.value }))}
                placeholder="Ex: 9 a cada 10 compram junto"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Produto do bump</Label>
              <Select value={newBump.bump_product_id} onValueChange={(v) => setNewBump((s) => ({ ...s, bump_product_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} - R$ {(p.price / 100).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desconto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={newBump.discount_percentage}
                onChange={(e) => setNewBump((s) => ({ ...s, discount_percentage: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={newBump.description}
              onChange={(e) => setNewBump((s) => ({ ...s, description: e.target.value }))}
              placeholder="Texto curto que aparece no card do order bump"
              rows={2}
              className="mt-1"
            />
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleAddBump} disabled={addingBump}>
            {addingBump ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar Order Bump
          </Button>
        </div>
      </div>
    </div>
  );
}
