import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Plus, Loader2, Zap, CalendarIcon, ShoppingBag, Trash2, Clock,
} from "lucide-react";

export default function AdminFakeSales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [customPrice, setCustomPrice] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [spreadDays, setSpreadDays] = useState("1");

  const { data: products = [] } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, title, price, producer_id")
        .order("title");
      return data || [];
    },
  });

  const { data: recentFakes = [] } = useQuery({
    queryKey: ["admin-recent-fakes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, payment_provider, status, created_at, product_id, products(title)")
        .like("payment_id", "fake_%")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const generateSales = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Selecione um produto");
      const qty = parseInt(quantity) || 1;
      const product = products.find((p: any) => p.id === productId);
      if (!product) throw new Error("Produto não encontrado");

      const price = customPrice ? Math.round(parseFloat(customPrice) * 100) : product.price;
      const days = scheduled ? parseInt(spreadDays) || 1 : 1;
      const perDay = Math.ceil(qty / days);

      const salesToInsert = [];
      for (let d = 0; d < days; d++) {
        const count = d === days - 1 ? qty - perDay * d : perDay;
        for (let i = 0; i < count; i++) {
          const saleDate = new Date(scheduleDate || new Date());
          saleDate.setDate(saleDate.getDate() + d);
          // Random hour spread
          saleDate.setHours(8 + Math.floor(Math.random() * 14));
          saleDate.setMinutes(Math.floor(Math.random() * 60));

          let platformFee = 0;
          if (method === "card") {
            platformFee = Math.round(price * 0.0389 + 249);
          }

          salesToInsert.push({
            product_id: productId,
            producer_id: product.producer_id,
            buyer_id: null,
            affiliate_id: null,
            amount: price,
            platform_fee: platformFee,
            payment_provider: method,
            payment_id: `fake_${crypto.randomUUID().slice(0, 8)}`,
            status: "completed",
            created_at: saleDate.toISOString(),
          });
        }
      }

      // Insert in batches of 50
      for (let i = 0; i < salesToInsert.length; i += 50) {
        const batch = salesToInsert.slice(i, i + 50);
        const { error } = await supabase.from("sales").insert(batch);
        if (error) throw error;
      }

      return salesToInsert.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count} venda(s) gerada(s) com sucesso!` });
      setQuantity("1");
      setCustomPrice("");
      queryClient.invalidateQueries({ queryKey: ["admin-recent-fakes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteFake = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Venda removida" });
      queryClient.invalidateQueries({ queryKey: ["admin-recent-fakes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const selectedProduct = products.find((p: any) => p.id === productId);
  const fmt = (v: number) => `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerar Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simule vendas para preencher dados da plataforma
        </p>
      </div>

      {/* Generator form */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Nova simulação
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Product */}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar produto..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} — {fmt(p.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-1">
            <Label className="text-xs">Quantidade</Label>
            <Input
              type="number"
              min="1"
              max="500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Method */}
          <div className="space-y-1">
            <Label className="text-xs">Método</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom price */}
          <div className="space-y-1">
            <Label className="text-xs">Preço customizado (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder={selectedProduct ? (selectedProduct.price / 100).toFixed(2) : "0.00"}
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
            />
          </div>

          {/* Schedule toggle */}
          <div className="flex items-end gap-3 pb-1">
            <Switch checked={scheduled} onCheckedChange={setScheduled} />
            <Label className="text-xs">Agendar / Distribuir em dias</Label>
          </div>
        </div>

        {/* Schedule options */}
        {scheduled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border"
          >
            <div className="space-y-1">
              <Label className="text-xs">Data inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleDate
                      ? format(scheduleDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Distribuir em quantos dias?</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={spreadDays}
                onChange={(e) => setSpreadDays(e.target.value)}
              />
              <p className="text-[0.65rem] text-muted-foreground">
                {parseInt(quantity) || 1} vendas em {parseInt(spreadDays) || 1} dias ≈{" "}
                {Math.ceil((parseInt(quantity) || 1) / (parseInt(spreadDays) || 1))} vendas/dia
              </p>
            </div>
          </motion.div>
        )}

        <Button
          className="gap-1.5"
          onClick={() => generateSales.mutate()}
          disabled={generateSales.isPending || !productId}
        >
          {generateSales.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Gerar {quantity} venda(s)
        </Button>
      </div>

      {/* Recent fake sales */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShoppingBag className="h-3.5 w-3.5" />
            Vendas simuladas recentes
          </h2>
        </div>
        {recentFakes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma venda simulada ainda.
          </div>
        ) : (
          recentFakes.map((s: any, i: number) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[0.65rem] text-muted-foreground whitespace-nowrap">
                    {format(new Date(s.created_at), "dd/MM HH:mm")}
                  </span>
                </div>
                <span className="text-sm truncate">
                  {(s as any).products?.title || "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-primary">{fmt(s.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteFake.mutate(s.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
