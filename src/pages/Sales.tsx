import { StatCard } from "@/components/StatCard";
import { RecentSalesTable } from "@/components/RecentSalesTable";
import { ExportButton } from "@/components/ExportButton";
import { DollarSign, ShoppingCart, Percent, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Sales() {
  const { user } = useAuth();

  const { data: sales = [] } = useQuery({
    queryKey: ["sales-stats", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sales")
        .select("amount, platform_fee, status, created_at, payment_provider, product_id, products(title)")
        .eq("producer_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const completed = sales.filter((s: any) => s.status === "completed");
  const totalRevenue = completed.reduce((acc: number, s: any) => acc + s.amount, 0);
  const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0;

  const salesStats = [
    {
      title: "Receita Total",
      value: `R$ ${(totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      change: `${completed.length} vendas concluídas`,
      changeType: "positive" as const,
      icon: DollarSign,
    },
    {
      title: "Total de Vendas",
      value: sales.length.toString(),
      change: "Todas as vendas",
      changeType: "positive" as const,
      icon: ShoppingCart,
    },
    {
      title: "Taxa de Conversão",
      value: sales.length > 0 ? `${((completed.length / sales.length) * 100).toFixed(1)}%` : "0%",
      change: "Vendas concluídas / total",
      changeType: "neutral" as const,
      icon: Percent,
    },
    {
      title: "Ticket Médio",
      value: `R$ ${(avgTicket / 100).toFixed(2)}`,
      change: "Valor médio por venda",
      changeType: "neutral" as const,
      icon: TrendingUp,
    },
  ];

  const exportColumns = [
    { key: "product_title", label: "Produto" },
    { key: "amount_formatted", label: "Valor (R$)" },
    { key: "status", label: "Status" },
    { key: "payment_provider", label: "Pagamento" },
    { key: "created_at", label: "Data" },
  ];

  const exportData = sales.map((s: any) => ({
    product_title: s.products?.title || "Produto removido",
    amount_formatted: (s.amount / 100).toFixed(2),
    status: s.status === "completed" ? "Pago" : s.status === "pending" ? "Pendente" : s.status,
    payment_provider: s.payment_provider || "N/A",
    created_at: new Date(s.created_at).toLocaleDateString("pt-BR"),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-title">Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe suas vendas e métricas de conversão
          </p>
        </div>
        <ExportButton data={exportData} columns={exportColumns} filename="vendas-vitrapay" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {salesStats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>
      <RecentSalesTable />
    </div>
  );
}
