import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

interface Props {
  userId?: string;
}

export default function EditProductCoupons({ userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCoupon, setNewCoupon] = useState({ code: "", discount_value: "", discount_type: "percentage", max_uses: "" });
  const [creating, setCreating] = useState(false);

  const { data: coupons = [] } = useQuery({
    queryKey: ["product-coupons", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("producer_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  const handleCreate = async () => {
    if (!userId || !newCoupon.code || !newCoupon.discount_value) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("coupons").insert({
        code: newCoupon.code.toUpperCase(),
        discount_value: parseInt(newCoupon.discount_value),
        discount_type: newCoupon.discount_type,
        max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null,
        producer_id: userId,
      });
      if (error) throw error;
      toast({ title: "Cupom criado!" });
      setNewCoupon({ code: "", discount_value: "", discount_type: "percentage", max_uses: "" });
      queryClient.invalidateQueries({ queryKey: ["product-coupons"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold">Criar novo cupom</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Código</Label>
            <Input placeholder="DESCONTO10" value={newCoupon.code} onChange={(e) => setNewCoupon((c) => ({ ...c, code: e.target.value.toUpperCase() }))} className="mt-1 uppercase" />
          </div>
          <div>
            <Label className="text-xs">Valor</Label>
            <Input type="number" placeholder="10" value={newCoupon.discount_value} onChange={(e) => setNewCoupon((c) => ({ ...c, discount_value: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <select value={newCoupon.discount_type} onChange={(e) => setNewCoupon((c) => ({ ...c, discount_type: e.target.value }))} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="percentage">Percentual (%)</option>
              <option value="fixed">Fixo (centavos)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Máx. usos</Label>
            <Input type="number" placeholder="Ilimitado" value={newCoupon.max_uses} onChange={(e) => setNewCoupon((c) => ({ ...c, max_uses: e.target.value }))} className="mt-1" />
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Criar Cupom
        </Button>
      </div>

      {coupons.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_80px_80px] gap-3 px-4 py-3 border-b border-border text-[0.6rem] uppercase tracking-widest text-muted-foreground font-medium">
            <span>Código</span><span>Desconto</span><span>Usos</span><span>Status</span>
          </div>
          {coupons.map((coupon: any) => (
            <div key={coupon.id} className="grid grid-cols-[1fr_100px_80px_80px] gap-3 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <span className="text-sm font-mono font-bold">{coupon.code}</span>
              <span className="text-sm">
                {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `R$ ${(coupon.discount_value / 100).toFixed(2)}`}
              </span>
              <span className="text-sm text-muted-foreground">{coupon.uses || 0}{coupon.max_uses ? `/${coupon.max_uses}` : ""}</span>
              <Badge variant={coupon.is_active ? "default" : "secondary"} className="text-[0.6rem] w-fit">
                {coupon.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
