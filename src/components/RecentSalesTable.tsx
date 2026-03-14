import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const mockSales = [
  { id: "TXN-001", product: "Curso de React Avançado", buyer: "João Silva", amount: 29700, status: "completed", date: "Há 2 min" },
  { id: "TXN-002", product: "Pack de Templates UI", buyer: "Maria Santos", amount: 4900, status: "completed", date: "Há 15 min" },
  { id: "TXN-003", product: "Mentoria 1:1 Marketing", buyer: "Pedro Costa", amount: 99900, status: "pending", date: "Há 1h" },
  { id: "TXN-004", product: "E-book Copywriting", buyer: "Ana Lima", amount: 3900, status: "completed", date: "Há 2h" },
  { id: "TXN-005", product: "Curso de Python", buyer: "Lucas Oliveira", amount: 19900, status: "completed", date: "Há 3h" },
];

export function RecentSalesTable() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm tracking-title">Vendas Recentes</h3>
      </div>
      <div className="divide-y divide-border">
        {mockSales.map((sale, i) => (
          <motion.div
            key={sale.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{sale.product}</p>
              <p className="text-xs text-muted-foreground">{sale.buyer}</p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <Badge
                variant={sale.status === "completed" ? "default" : "secondary"}
                className={`text-[0.6rem] ${sale.status === "completed" ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}`}
              >
                {sale.status === "completed" ? "Pago" : "Pendente"}
              </Badge>
              <span className="text-sm font-semibold stat-value min-w-[80px] text-right">
                R$ {(sale.amount / 100).toFixed(2)}
              </span>
              <span className="text-[0.65rem] text-muted-foreground min-w-[60px] text-right">
                {sale.date}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
