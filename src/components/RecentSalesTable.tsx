import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function RecentSalesTable() {
  const { user } = useAuth();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["recent-sales", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("id, amount, status, created_at, product_id, products(title)")
        .eq("producer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `Há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Há ${days}d`;
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm tracking-title">Vendas Recentes</h3>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sales.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma venda realizada ainda.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sales.map((sale: any, i: number) => (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {sale.products?.title || "Produto removido"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sale.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <Badge
                  variant={sale.status === "completed" ? "default" : "secondary"}
                  className={`text-[0.6rem] ${
                    sale.status === "completed"
                      ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                      : ""
                  }`}
                >
                  {sale.status === "completed" ? "Pago" : "Pendente"}
                </Badge>
                <span className="text-sm font-semibold stat-value min-w-[80px] text-right">
                  R$ {(sale.amount / 100).toFixed(2)}
                </span>
                <span className="text-[0.65rem] text-muted-foreground min-w-[60px] text-right">
                  {timeAgo(sale.created_at)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
