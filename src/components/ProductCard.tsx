import { motion } from "framer-motion";
import { Download, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface ProductCardProps {
  id: string;
  title: string;
  producer: string;
  price: number;
  coverColor: string;
  type: "download" | "lms";
  sales: number;
  commission: number;
  index?: number;
}

export function ProductCard({
  id,
  title,
  producer,
  price,
  coverColor,
  type,
  sales,
  commission,
  index = 0,
}: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
    >
      <Link to={`/product/${id}`} className="group block">
        <div className="overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/30">
          <div
            className="aspect-[4/3] w-full flex items-center justify-center"
            style={{ backgroundColor: coverColor }}
          >
            {type === "download" ? (
              <Download className="h-10 w-10 text-foreground/20" strokeWidth={1.5} />
            ) : (
              <BookOpen className="h-10 w-10 text-foreground/20" strokeWidth={1.5} />
            )}
          </div>
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-sm tracking-title text-card-foreground line-clamp-1 group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{producer}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold tracking-title text-primary stat-value">
                R$ {(price / 100).toFixed(2)}
              </span>
              <Badge variant="secondary" className="text-[0.65rem] gap-1">
                <Users className="h-3 w-3" strokeWidth={1.5} />
                {commission}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.65rem] text-muted-foreground">
                {sales} vendas
              </span>
              <Badge variant="outline" className="text-[0.65rem]">
                {type === "download" ? "Download" : "Área de Membros"}
              </Badge>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
