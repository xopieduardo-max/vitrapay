import { Plus, MoreHorizontal, Eye, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MyProducts() {
  const { user } = useAuth();

  const { data: myProducts = [], isLoading } = useQuery({
    queryKey: ["my-products", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("producer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-title">Meus Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus produtos digitais
          </p>
        </div>
        <Button className="gap-2" asChild>
          <Link to="/products/new">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Novo Produto
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : myProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">Nenhum produto criado ainda.</p>
          <Button className="mt-4 gap-2" asChild>
            <Link to="/products/new">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Criar primeiro produto
            </Link>
          </Button>
        </div>
      ) : (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_50px] gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-label text-muted-foreground">
          <span>Produto</span>
          <span>Preço</span>
          <span>Status</span>
          <span></span>
        </div>
        {myProducts.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="grid grid-cols-[1fr_120px_100px_50px] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
          >
            <div>
              <p className="text-sm font-medium">{product.title}</p>
              <p className="text-xs text-muted-foreground">{product.type === "lms" ? "Área de Membros" : "Download"}</p>
            </div>
            <span className="text-sm font-semibold stat-value">
              R$ {(product.price / 100).toFixed(2)}
            </span>
            <Badge variant="secondary" className={`text-[0.65rem] w-fit ${product.is_published ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}`}>
              {product.is_published ? "Ativo" : "Rascunho"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2 text-sm">
                  <Eye className="h-4 w-4" strokeWidth={1.5} /> Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-sm">
                  <Edit className="h-4 w-4" strokeWidth={1.5} /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-sm text-destructive">
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        ))}
      </div>
      )}
    </div>
  );
}
