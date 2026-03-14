import { DollarSign, Package, Users, Link2, Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RecentSalesTable } from "@/components/RecentSalesTable";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: salesData = [] } = useQuery({
    queryKey: ["dashboard-sales", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("amount, platform_fee, status, created_at")
        .eq("producer_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: productsCount = 0 } = useQuery({
    queryKey: ["dashboard-products-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("producer_id", user.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: affiliatesCount = 0 } = useQuery({
    queryKey: ["dashboard-affiliates-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: products } = await supabase
        .from("products")
        .select("id")
        .eq("producer_id", user.id);
      if (!products?.length) return 0;
      const { count } = await supabase
        .from("affiliates")
        .select("*", { count: "exact", head: true })
        .in("product_id", products.map((p) => p.id));
      return count || 0;
    },
    enabled: !!user,
  });

  const completedSales = salesData.filter((s) => s.status === "completed");
  const totalRevenue = completedSales.reduce(
    (acc, s) => acc + (s.amount - (s.platform_fee || 0)),
    0
  );
  const totalSalesCount = salesData.length;

  const stats = [
    {
      title: "Seu Lucro",
      value: `R$ ${(totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      change: `${completedSales.length} vendas concluídas`,
      changeType: "positive" as const,
      icon: DollarSign,
    },
    {
      title: "Vendas Totais",
      value: totalSalesCount.toString(),
      change: "Todas as vendas registradas",
      changeType: "positive" as const,
      icon: Package,
    },
    {
      title: "Seus Produtos",
      value: productsCount.toString(),
      change: "Produtos cadastrados",
      changeType: "neutral" as const,
      icon: Users,
    },
    {
      title: "Afiliados",
      value: affiliatesCount.toString(),
      change: "Afiliados nos seus produtos",
      changeType: "neutral" as const,
      icon: Link2,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da sua plataforma
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>

      <RecentSalesTable />
    </div>
  );
}
