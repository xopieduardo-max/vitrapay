import { motion } from "framer-motion";
import { Download, BookOpen, Flame, ArrowRight } from "lucide-react";

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

  // Temperature dots (1-5 based on sales)
  const tempLevel = Math.min(Math.ceil(salesCount / 10), 5) || 1;
  const commissionValue = (price / 100) * (commission / 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.2, 0, 0, 1] }}
    >
      <button onClick={onClick} className="group block w-full text-left">
        <div
          className={`overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 ${
            featured
              ? "border-primary/30 shadow-md shadow-primary/10"
              : "border-border/60 hover:border-primary/40"
          }`}
        >
          {/* Cover Image */}
          <div className="aspect-[4/3] w-full overflow-hidden relative bg-muted/20">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20">
                {type === "download" ? (
                  <Download className="h-12 w-12 text-foreground/10" strokeWidth={1.2} />
                ) : (
                  <BookOpen className="h-12 w-12 text-foreground/10" strokeWidth={1.2} />
                )}
              </div>
            )}

            {/* Gradient overlay at bottom for readability */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

            {/* Featured badge */}
            {featured && (
              <div className="absolute top-3 left-3">
                <span className="flex items-center gap-1 bg-primary text-primary-foreground text-[0.6rem] font-bold uppercase px-2.5 py-1 rounded-full shadow-lg">
                  <Flame className="h-3 w-3" />
                  Em alta
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <h3 className="font-bold text-sm tracking-tight text-card-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
              {title}
            </h3>

            {/* Temperature + Rating */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i < tempLevel
                        ? "bg-destructive"
                        : "bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              {salesCount > 0 && (
                <span className="text-xs font-bold text-muted-foreground">
                  {temp}°
                </span>
              )}
            </div>

            {/* Commission info */}
            {commission > 0 && (
              <div>
                <span className="text-[0.65rem] text-muted-foreground">Você recebe até</span>
                <p className="text-lg font-bold text-primary mt-0.5">
                  R$ {commissionValue.toFixed(2).replace(".", ",")}
                </p>
              </div>
            )}

            {!commission && (
              <p className="text-lg font-bold text-primary">
                R$ {(price / 100).toFixed(2).replace(".", ",")}
              </p>
            )}

            {/* CTA Button */}
            <div
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
                commission > 0
                  ? "bg-primary text-primary-foreground group-hover:brightness-110 group-hover:shadow-lg group-hover:shadow-primary/20"
                  : "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
              }`}
            >
              {commission > 0 ? "Quero me afiliar" : "Ver produto"}
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
