import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Users, DollarSign, Package, TrendingUp, ShoppingBag, Clock } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profilesRes, productsRes, salesRes, withdrawalsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("sales").select("amount, platform_fee, status, created_at").eq("status", "completed"),
        supabase.from("withdrawals").select("amount, status"),
      ]);

      const sales = salesRes.data || [];
      const totalRevenue = sales.reduce((a, s) => a + s.amount, 0);
      const totalPlatformFees = sales.reduce((a, s) => a + (s.platform_fee || 0), 0);
      const pendingWithdrawals = (withdrawalsRes.data || [])
        .filter((w) => w.status === "pending")
        .reduce((a, w) => a + w.amount, 0);

      // Sales last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSales = sales.filter((s) => new Date(s.created_at) >= sevenDaysAgo);

      return {
        totalUsers: profilesRes.count || 0,
        totalProducts: productsRes.count || 0,
        totalSales: sales.length,
        totalRevenue,
        totalPlatformFees,
        pendingWithdrawals,
        recentSalesCount: recentSales.length,
        recentRevenue: recentSales.reduce((a, s) => a + s.amount, 0),
      };
    },
  });

  // Top products
  const { data: topProducts = [] } = useQuery({
    queryKey: ["admin-top-products"],
    queryFn: async () => {
      const { data: sales } = await supabase
        .from("sales")
        .select("product_id, amount")
        .eq("status", "completed");
      if (!sales?.length) return [];

      const productMap: Record<string, { count: number; revenue: number }> = {};
      sales.forEach((s) => {
        if (!s.product_id) return;
        if (!productMap[s.product_id]) productMap[s.product_id] = { count: 0, revenue: 0 };
        productMap[s.product_id].count++;
        productMap[s.product_id].revenue += s.amount;
      });

      const sorted = Object.entries(productMap)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 5);

      const productIds = sorted.map(([id]) => id);
      const { data: products } = await supabase
        .from("products")
        .select("id, title, cover_url")
        .in("id", productIds);

      return sorted.map(([id, data]) => ({
        ...data,
        product: products?.find((p) => p.id === id),
      }));
    },
  });

  const fmt = (v: number) => `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const cards = [
    { label: "Usuários cadastrados", value: stats?.totalUsers ?? 0, icon: Users, color: "text-primary", isNumber: true },
    { label: "Produtos na plataforma", value: stats?.totalProducts ?? 0, icon: Package, color: "text-accent", isNumber: true },
    { label: "Faturamento total", value: stats?.totalRevenue ?? 0, icon: DollarSign, color: "text-primary", isNumber: false },
    { label: "Receita da plataforma", value: stats?.totalPlatformFees ?? 0, icon: TrendingUp, color: "text-accent", isNumber: false },
    { label: "Vendas (7 dias)", value: stats?.recentSalesCount ?? 0, icon: ShoppingBag, color: "text-warning", isNumber: true },
    { label: "Saques pendentes", value: stats?.pendingWithdrawals ?? 0, icon: Clock, color: "text-destructive", isNumber: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4 space-y-1"
          >
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>
              {card.isNumber ? card.value : fmt(card.value)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Top Products */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Produtos mais vendidos</h2>
        </div>
        {topProducts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <div>
            {topProducts.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-center font-bold">
                    #{i + 1}
                  </span>
                  {item.product?.cover_url && (
                    <img src={item.product.cover_url} alt="" className="h-8 w-8 rounded object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{item.product?.title || "Produto removido"}</p>
                    <p className="text-xs text-muted-foreground">{item.count} vendas</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-primary">{fmt(item.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
