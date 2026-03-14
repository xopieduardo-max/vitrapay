import { motion } from "framer-motion";
import { Download, BookOpen, Users, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  id: string;
  title: string;
  producer: string;
  price: number;
  coverUrl?: string | null;
  type: "download" | "lms";
  commission: number;
  salesCount?: number;
  index?: number;
  featured?: boolean;
  onClick?: () => void;
}

export function ProductCard({
  id,
  title,
  producer,
  price,
  coverUrl,
  type,
  commission,
  salesCount = 0,
  index = 0,
  featured = false,
  onClick,
}: ProductCardProps) {
  const temp = Math.min(salesCount, 200);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.2, 0, 0, 1] }}
    >
      <button onClick={onClick} className="group block w-full text-left">
        <div
          className={`overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg ${
            featured
              ? "border-primary/40 hover:border-primary/60 shadow-sm"
              : "border-border hover:border-primary/30"
          }`}
        >
          <div className="aspect-[16/10] w-full flex items-center justify-center bg-muted/30 overflow-hidden relative">
            {coverUrl ? (
              <img src={coverUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : type === "download" ? (
              <Download className="h-10 w-10 text-foreground/15" strokeWidth={1.5} />
            ) : (
              <BookOpen className="h-10 w-10 text-foreground/15" strokeWidth={1.5} />
            )}
            {salesCount > 0 && (
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1">
                <Flame className="h-3 w-3 text-destructive" strokeWidth={2} />
                <span className="text-[0.6rem] font-bold">{temp}°</span>
              </div>
            )}
            <div className="absolute bottom-2.5 left-2.5">
              <Badge variant="secondary" className="text-[0.6rem] bg-background/80 backdrop-blur-sm border-none">
                {type === "download" ? "Download" : "Área de Membros"}
              </Badge>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-sm tracking-tight text-card-foreground line-clamp-1 group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Por {producer}</p>
            </div>
            {commission > 0 && (
              <span className="text-[0.65rem] text-muted-foreground">Você recebe até</span>
            )}
            <div className="flex items-center justify-between">
              <div>
                {commission > 0 && (
                  <span className="text-lg font-bold text-primary">
                    R$ {((price / 100) * (commission / 100)).toFixed(2)}
                  </span>
                )}
                <p className="text-[0.65rem] text-muted-foreground">
                  {commission > 0 ? `Preço: R$ ${(price / 100).toFixed(2)}` : `R$ ${(price / 100).toFixed(2)}`}
                </p>
              </div>
              {commission > 0 && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[0.6rem] gap-1">
                  <Users className="h-3 w-3" strokeWidth={1.5} />
                  {commission}%
                </Badge>
              )}
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
