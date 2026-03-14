import { Copy, Check, Link2, TrendingUp, DollarSign, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const affiliateStats = [
  { title: "Cliques", value: "12.450", change: "+18.3% vs mês anterior", changeType: "positive" as const, icon: MousePointer },
  { title: "Conversões", value: "342", change: "+9.1% vs mês anterior", changeType: "positive" as const, icon: TrendingUp },
  { title: "Comissão Total", value: "R$ 8.240,00", change: "+22.5% vs mês anterior", changeType: "positive" as const, icon: DollarSign },
];

const affiliateLinks = [
  { product: "Curso de React Avançado", link: "aether.com/ref/abc123", clicks: 4230, conversions: 128, earnings: 371520 },
  { product: "Pack de Templates UI", link: "aether.com/ref/def456", clicks: 5120, conversions: 154, earnings: 226380 },
  { product: "E-book Copywriting", link: "aether.com/ref/ghi789", clicks: 3100, conversions: 60, earnings: 117000 },
];

export default function Affiliates() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = (link: string, idx: number) => {
    navigator.clipboard.writeText(link);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Painel de Afiliados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe seus links e comissões em tempo real
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {affiliateStats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm tracking-title">Seus Links de Afiliado</h3>
        </div>
        <div className="divide-y divide-border">
          {affiliateLinks.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.product}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Link2 className="h-3 w-3" strokeWidth={1.5} />
                  {item.link}
                </p>
              </div>
              <div className="flex items-center gap-6 ml-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{item.clicks} cliques</p>
                  <p className="text-xs text-muted-foreground">{item.conversions} conversões</p>
                </div>
                <span className="text-sm font-semibold stat-value text-primary min-w-[100px] text-right">
                  R$ {(item.earnings / 100).toFixed(2)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs w-[90px]"
                  onClick={() => handleCopy(item.link, i)}
                >
                  <AnimatePresence mode="wait">
                    {copiedIdx === i ? (
                      <motion.span key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-primary">
                        <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> Copiado
                      </motion.span>
                    ) : (
                      <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1">
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.5} /> Copiar
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
