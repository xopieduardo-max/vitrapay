import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Loader2, Zap, ShoppingBag, Trash2, Clock, Calendar, X,
} from "lucide-react";

interface DaySchedule {
  id: string;
  date: string; // YYYY-MM-DD
  pix: number;
  card: number;
  boleto: number;
}

const KNOWN_USERS = [
  { id: "e993bfd1-3253-4983-8471-f652ca2d7e92", label: "Eduardo (Admin)", email: "eduardo@xopi.com" },
  { id: "ab4f9f40-3bbf-44c7-a998-5b2b0cdd2744", label: "ECXGestão", email: "ecxgestao@gmail.com" },
  { id: "31d372d2-242d-4ee3-9051-7c5a2ed0de01", label: "Xopi", email: "xopieduardo@gmail.com" },
];

export default function AdminFakeSales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [producerId, setProducerId] = useState("");
  const [productId, setProductId] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [days, setDays] = useState<DaySchedule[]>([
    { id: crypto.randomUUID(), date: new Date().toISOString().split("T")[0], pix: 1, card: 0, boleto: 0 },
  ]);

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

  // Filter products by selected producer
  const filteredProducts = producerId
    ? products.filter((p: any) => p.producer_id === producerId)
    : products;

  const { data: recentFakes = [] } = useQuery({
    queryKey: ["admin-recent-fakes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, payment_provider, status, created_at, product_id, producer_id, products(title)")
        .like("payment_id", "fake_%")
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  const addDay = () => {
    const lastDate = days.length > 0 ? days[days.length - 1].date : new Date().toISOString().split("T")[0];
    const nextDate = new Date(lastDate + "T12:00:00");
    nextDate.setDate(nextDate.getDate() + 1);
    setDays([...days, {
      id: crypto.randomUUID(),
      date: nextDate.toISOString().split("T")[0],
      pix: 0,
      card: 0,
      boleto: 0,
    }]);
  };

  const removeDay = (id: string) => {
    if (days.length <= 1) return;
    setDays(days.filter((d) => d.id !== id));
  };

  const updateDay = (id: string, field: keyof DaySchedule, value: string | number) => {
    setDays(days.map((d) => d.id === id ? { ...d, [field]: value } : d));
  };

  const totalSales = days.reduce((acc, d) => acc + d.pix + d.card + d.boleto, 0);

  const generateSales = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Selecione um produto");
      if (!producerId) throw new Error("Selecione um usuário");
      if (totalSales === 0) throw new Error("Adicione pelo menos 1 venda");

      const product = products.find((p: any) => p.id === productId);
      if (!product) throw new Error("Produto não encontrado");

      const price = customPrice ? Math.round(parseFloat(customPrice) * 100) : product.price;

      const salesToInsert: any[] = [];

      for (const day of days) {
        const methods: { method: string; count: number; fee: (p: number) => number }[] = [
          { method: "pix", count: day.pix, fee: () => 0 },
          { method: "card", count: day.card, fee: (p) => Math.round(p * 0.0389 + 249) },
          { method: "boleto", count: day.boleto, fee: () => 0 },
        ];

        for (const { method, count, fee } of methods) {
          for (let i = 0; i < count; i++) {
            const saleDate = new Date(day.date + "T12:00:00");
            // Random hour between 7:00 and 22:59
            saleDate.setHours(7 + Math.floor(Math.random() * 16));
            saleDate.setMinutes(Math.floor(Math.random() * 60));
            saleDate.setSeconds(Math.floor(Math.random() * 60));

            salesToInsert.push({
              product_id: productId,
              producer_id: producerId,
              buyer_id: null,
              affiliate_id: null,
              amount: price,
              platform_fee: fee(price),
              payment_provider: method,
              payment_id: `fake_${crypto.randomUUID().slice(0, 8)}`,
              status: "completed",
              created_at: saleDate.toISOString(),
            });
          }
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
      toast({ title: `✅ ${count} venda(s) gerada(s) com sucesso!` });
      setDays([{ id: crypto.randomUUID(), date: new Date().toISOString().split("T")[0], pix: 1, card: 0, boleto: 0 }]);
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

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T12:00:00");
      return format(d, "dd/MM (EEEE)", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerar Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simule vendas reais nos dashboards dos produtores
        </p>
      </div>

      {/* Generator form */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Nova simulação
        </h3>

        {/* Row 1: User + Product */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Produtor (usuário)</Label>
            <Select value={producerId} onValueChange={(v) => { setProducerId(v); setProductId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar usuário..." />
              </SelectTrigger>
              <SelectContent>
                {KNOWN_USERS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label} — {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Produto</Label>
            <Select value={productId} onValueChange={setProductId} disabled={!producerId}>
              <SelectTrigger>
                <SelectValue placeholder={producerId ? "Selecionar produto..." : "Selecione um usuário primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} — {fmt(p.price)}
                  </SelectItem>
                ))}
                {filteredProducts.length === 0 && producerId && (
                  <div className="p-3 text-xs text-muted-foreground text-center">Nenhum produto deste usuário</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom price */}
        <div className="max-w-xs space-y-1">
          <Label className="text-xs">Preço customizado (opcional)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={selectedProduct ? (selectedProduct.price / 100).toFixed(2) : "0.00"}
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
        </div>

        {/* Day Schedules */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Distribuição por dia
            </Label>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addDay}>
              <Plus className="h-3 w-3" /> Adicionar dia
            </Button>
          </div>

          <div className="space-y-2">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-[140px_1fr_1fr_1fr_40px] gap-2 text-[0.65rem] text-muted-foreground uppercase tracking-label px-1">
              <span>Data</span>
              <span>Pix</span>
              <span>Cartão</span>
              <span>Boleto</span>
              <span />
            </div>

            <AnimatePresence mode="popLayout">
              {days.map((day) => (
                <motion.div
                  key={day.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-[140px_1fr_1fr_1fr_40px] gap-2 items-end"
                >
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <Label className="text-[0.6rem] sm:hidden text-muted-foreground">Data</Label>
                    <Input
                      type="date"
                      value={day.date}
                      onChange={(e) => updateDay(day.id, "date", e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.6rem] sm:hidden text-muted-foreground">Pix</Label>
                    <Input
                      type="number"
                      min="0"
                      max="500"
                      value={day.pix}
                      onChange={(e) => updateDay(day.id, "pix", parseInt(e.target.value) || 0)}
                      className="h-9 text-xs"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.6rem] sm:hidden text-muted-foreground">Cartão</Label>
                    <Input
                      type="number"
                      min="0"
                      max="500"
                      value={day.card}
                      onChange={(e) => updateDay(day.id, "card", parseInt(e.target.value) || 0)}
                      className="h-9 text-xs"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.6rem] sm:hidden text-muted-foreground">Boleto</Label>
                    <Input
                      type="number"
                      min="0"
                      max="500"
                      value={day.boleto}
                      onChange={(e) => updateDay(day.id, "boleto", parseInt(e.target.value) || 0)}
                      className="h-9 text-xs"
                      placeholder="0"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive shrink-0"
                    onClick={() => removeDay(day.id)}
                    disabled={days.length <= 1}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>
              Total: <strong className="text-foreground">{totalSales} venda(s)</strong>
            </span>
            <span>
              Pix: <strong className="text-primary">{days.reduce((a, d) => a + d.pix, 0)}</strong>
            </span>
            <span>
              Cartão: <strong className="text-primary">{days.reduce((a, d) => a + d.card, 0)}</strong>
            </span>
            <span>
              Boleto: <strong className="text-primary">{days.reduce((a, d) => a + d.boleto, 0)}</strong>
            </span>
            {selectedProduct && (
              <span className="ml-auto">
                Valor total: <strong className="text-foreground">
                  {fmt((customPrice ? Math.round(parseFloat(customPrice) * 100) : selectedProduct.price) * totalSales)}
                </strong>
              </span>
            )}
          </div>
        </div>

        <Button
          className="gap-1.5"
          onClick={() => generateSales.mutate()}
          disabled={generateSales.isPending || !productId || !producerId || totalSales === 0}
        >
          {generateSales.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Gerar {totalSales} venda(s)
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
          recentFakes.map((s: any, i: number) => {
            const user = KNOWN_USERS.find((u) => u.id === s.producer_id);
            return (
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
                  <span className="text-[0.6rem] uppercase tracking-label text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                    {s.payment_provider}
                  </span>
                  {user && (
                    <span className="text-[0.6rem] text-muted-foreground hidden md:inline">
                      → {user.label}
                    </span>
                  )}
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
            );
          })
        )}
      </div>
    </div>
  );
}
