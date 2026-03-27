import { Plus, MoreHorizontal, Eye, Edit, Trash2, Loader2, BarChart3, Radio, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MyProducts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (error) {
      toast.error("Erro ao excluir produto");
    } else {
      toast.success("Produto excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    }
  };

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

  const productIds = myProducts.map((p) => p.id);

  const { data: pixelCounts = {} } = useQuery({
    queryKey: ["pixel-counts", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return {};
      const { data, error } = await supabase
        .from("product_pixels")
        .select("product_id, platform")
        .in("product_id", productIds);
      if (error) throw error;
      const counts: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!counts[row.product_id]) counts[row.product_id] = [];
        if (!counts[row.product_id].includes(row.platform)) {
          counts[row.product_id].push(row.platform);
        }
      }
      return counts;
    },
    enabled: productIds.length > 0,
  });

  const { data: salesCounts = {} } = useQuery({
    queryKey: ["sales-counts", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return {};
      const { data, error } = await supabase
        .from("sales")
        .select("product_id, status")
        .in("product_id", productIds)
        .eq("status", "paid");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.product_id!] = (counts[row.product_id!] || 0) + 1;
      }
      return counts;
    },
    enabled: productIds.length > 0,
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
          <div className="grid grid-cols-[auto_1fr_120px_100px_80px_80px_50px] gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-label text-muted-foreground">
            <span className="w-10"></span>
            <span>Produto</span>
            <span>Preço</span>
            <span>Status</span>
            <span>Vendas</span>
            <span>Pixels</span>
            <span></span>
          </div>
          {myProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="grid grid-cols-[auto_1fr_120px_100px_80px_80px_50px] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/products/${product.id}/edit`)}
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                {product.cover_url ? (
                  <img src={product.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">📦</div>
                )}
              </div>
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
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{salesCounts[product.id] || 0}</span>
              </div>
              {(pixelCounts[product.id] ?? []).length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary font-medium">{pixelCounts[product.id].length}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenuItem className="gap-2 text-sm" onClick={() => window.open(`/checkout/${product.id}`, "_blank")}>
                    <Eye className="h-4 w-4" strokeWidth={1.5} /> Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-sm" onClick={() => navigate(`/products/${product.id}/edit`)}>
                    <Edit className="h-4 w-4" strokeWidth={1.5} /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-sm" onClick={() => navigate(`/products/${product.id}/edit?tab=pixels`)}>
                    <BarChart3 className="h-4 w-4" strokeWidth={1.5} /> Pixels
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
