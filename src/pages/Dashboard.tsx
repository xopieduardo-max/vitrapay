import { DollarSign, Package, Users, Link2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RecentSalesTable } from "@/components/RecentSalesTable";

const stats = [
  {
    title: "Seu Lucro",
    value: "R$ 24.580,00",
    change: "+12.4% vs mês anterior",
    changeType: "positive" as const,
    icon: DollarSign,
  },
  {
    title: "Produtos Vendidos",
    value: "1.842",
    change: "+8.2% vs mês anterior",
    changeType: "positive" as const,
    icon: Package,
  },
  {
    title: "Produtores Ativos",
    value: "342",
    change: "+23 novos este mês",
    changeType: "positive" as const,
    icon: Users,
  },
  {
    title: "Afiliados Ativos",
    value: "1.205",
    change: "+5.7% vs mês anterior",
    changeType: "positive" as const,
    icon: Link2,
  },
];

export default function Dashboard() {
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
