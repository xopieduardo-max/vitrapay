import { mockProducts } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function Purchases() {
  const purchases = mockProducts.slice(0, 3).map((p, i) => ({
    ...p,
    date: `${10 + i}/03/2026`,
    txId: `TXN-${900 + i}`,
  }));

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
        {purchases.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="grid grid-cols-[1fr_120px_120px_100px] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
          >
            <div>
              <p className="text-sm font-medium">{p.title}</p>
              <p className="text-[0.65rem] text-muted-foreground">{p.txId}</p>
            </div>
            <span className="text-sm font-semibold stat-value">R$ {(p.price / 100).toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">{p.date}</span>
            <Badge variant="secondary" className="text-[0.65rem] bg-primary/10 text-primary border-primary/20 w-fit">
              Pago
            </Badge>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
