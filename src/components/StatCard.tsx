import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  index?: number;
}

export function StatCard({ title, value, change, changeType, icon: Icon, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="group relative border-b border-border p-5 bg-card rounded-lg hover:bg-card/80 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-title stat-value text-gradient-primary">
            {value}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <p className={`mt-2 text-xs tracking-interface ${
        changeType === "positive"
          ? "text-primary"
          : changeType === "negative"
          ? "text-destructive"
          : "text-muted-foreground"
      }`}>
        {change}
      </p>
    </motion.div>
  );
}
