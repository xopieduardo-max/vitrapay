import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, ChevronRight, Package, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.45, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

export default function Purchases() {
  const { user } = useAuth();

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["my-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("id, amount, status, created_at, products(title)")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const statusMap: Record<string, { label: string; className: string }> = {
    completed: { label: "Pago", className: "bg-primary/10 text-primary border-primary/20" },
    pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    refunded: { label: "Reembolsado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const totalSpent = useMemo(() =>
    purchases.filter((p: any) => p.status === "completed").reduce((acc: number, p: any) => acc + p.amount, 0),
    [purchases]
  );

  const completedCount = useMemo(() =>
    purchases.filter((p: any) => p.status === "completed").length,
    [purchases]
  );

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Premium Header */}
      <motion.div {...anim(0)} className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold tracking-tight">Minhas Compras</h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico de compras realizadas</p>
      </motion.div>

      {/* Breadcrumb */}
      <motion.div {...anim(0.04)} className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <span className="hover:text-foreground transition-colors cursor-pointer">Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Minhas Compras</span>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2">
        <motion.div {...anim(0.06)} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <div className="flex items-start justify-between">
            <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">TOTAL GASTO</p>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-primary">R$ {(totalSpent / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs mt-1 text-muted-foreground">em {completedCount} compras</p>
        </motion.div>
        <motion.div {...anim(0.08)} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <div className="flex items-start justify-between">
            <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">COMPRAS</p>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-primary" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-primary">{purchases.length}</p>
          <p className="text-xs mt-1 text-muted-foreground">produtos adquiridos</p>
        </motion.div>
      </div>

      {/* Purchases Table */}
      <motion.div {...anim(0.1)} className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-primary" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold">Histórico ({purchases.length})</h3>
        </div>

        <div className="hidden sm:grid grid-cols-[1fr_120px_120px_100px] gap-4 px-5 py-2.5 border-b border-border text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span>Produto</span>
          <span>Valor</span>
          <span>Data</span>
          <span>Status</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Package className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold">Nenhuma compra realizada ainda</p>
              <p className="text-sm text-muted-foreground mt-1">Quando você comprar um produto, ele aparecerá aqui</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {purchases.map((p: any, i: number) => {
              const st = statusMap[p.status] || statusMap.pending;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_120px_100px] gap-1 sm:gap-4 items-start sm:items-center px-5 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{p.products?.title || "Produto removido"}</p>
                    <p className="text-[0.65rem] text-muted-foreground font-mono">{p.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">R$ {(p.amount / 100).toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <Badge variant="secondary" className={`text-[0.65rem] w-fit ${st.className}`}>
                    {st.label}
                  </Badge>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
