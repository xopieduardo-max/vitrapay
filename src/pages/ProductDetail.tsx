import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, BookOpen, Users, Star, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockProducts } from "@/lib/mockData";
import { motion } from "framer-motion";

export default function ProductDetail() {
  const { id } = useParams();
  const product = mockProducts.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Produto não encontrado</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Voltar ao Marketplace
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div
          className="aspect-[4/3] rounded-lg flex items-center justify-center"
          style={{ backgroundColor: product.coverColor }}
        >
          {product.type === "download" ? (
            <Download className="h-16 w-16 text-foreground/20" strokeWidth={1.5} />
          ) : (
            <BookOpen className="h-16 w-16 text-foreground/20" strokeWidth={1.5} />
          )}
        </div>

        <div className="space-y-6">
          <div>
            <Badge variant="outline" className="mb-3 text-xs">
              {product.type === "download" ? "Download Digital" : "Área de Membros"}
            </Badge>
            <h1 className="text-2xl font-bold tracking-title">{product.title}</h1>
            <p className="text-muted-foreground mt-1">{product.producer}</p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-primary stat-value">
              R$ {(product.price / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
              {product.sales} vendas
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" strokeWidth={1.5} />
              {product.commission}% comissão
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4" strokeWidth={1.5} />
              4.8
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <Button className="w-full h-12 text-base font-semibold hover:glow-primary transition-shadow">
              Comprar Agora
            </Button>
            <Button variant="outline" className="w-full">
              Tornar-se Afiliado
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Pagamento seguro via Stripe ou Mercado Pago. Acesso imediato após confirmação.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
