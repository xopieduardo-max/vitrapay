import { Download, BookOpen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockProducts } from "@/lib/mockData";
import { motion } from "framer-motion";

export default function BuyerLibrary() {
  const purchasedProducts = mockProducts.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Minha Biblioteca</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acesse seus produtos comprados
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {purchasedProducts.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            <div
              className="aspect-video w-full flex items-center justify-center"
              style={{ backgroundColor: product.coverColor }}
            >
              {product.type === "download" ? (
                <Download className="h-8 w-8 text-foreground/20" strokeWidth={1.5} />
              ) : (
                <BookOpen className="h-8 w-8 text-foreground/20" strokeWidth={1.5} />
              )}
            </div>
            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-sm tracking-title">{product.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{product.producer}</p>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[0.65rem]">
                  {product.type === "download" ? "Download" : "Curso"}
                </Badge>
                <Button size="sm" className="gap-1.5 h-8 text-xs">
                  {product.type === "download" ? (
                    <>
                      <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Baixar
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Acessar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
