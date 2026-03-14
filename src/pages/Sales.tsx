import { RecentSalesTable } from "@/components/RecentSalesTable";
import { StatCard } from "@/components/StatCard";
import { DollarSign, ShoppingCart, Percent, TrendingUp } from "lucide-react";

const salesStats = [
  { title: "Receita Total", value: "R$ 124.580,00", change: "+15.2% vs mês anterior", changeType: "positive" as const, icon: DollarSign },
  { title: "Total de Vendas", value: "3.842", change: "+11.8% vs mês anterior", changeType: "positive" as const, icon: ShoppingCart },
  { title: "Taxa de Conversão", value: "4.2%", change: "+0.3% vs mês anterior", changeType: "positive" as const, icon: Percent },
  { title: "Ticket Médio", value: "R$ 32,40", change: "+3.1% vs mês anterior", changeType: "positive" as const, icon: TrendingUp },
];

export default function Sales() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe suas vendas e métricas de conversão
        </p>
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
