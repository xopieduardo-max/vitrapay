import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    pending: { label: "Pendente", className: "" },
    refunded: { label: "Reembolsado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Minhas Compras</h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico de compras</p>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_100px] gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-label text-muted-foreground">
          <span>Produto</span>
          <span>Valor</span>
          <span>Data</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma compra realizada ainda.
          </div>
        ) : (
          purchases.map((p: any, i: number) => {
            const st = statusMap[p.status] || statusMap.pending;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
                className="grid grid-cols-[1fr_120px_120px_100px] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{p.products?.title || "Produto removido"}</p>
                  <p className="text-[0.65rem] text-muted-foreground">{p.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <span className="text-sm font-semibold stat-value">R$ {(p.amount / 100).toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </span>
                <Badge variant="secondary" className={`text-[0.65rem] w-fit ${st.className}`}>
                  {st.label}
                </Badge>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
