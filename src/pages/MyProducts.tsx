import { Plus, MoreHorizontal, Eye, Edit, Trash2, Loader2, BarChart3, Radio, ShoppingCart, Package, ChevronRight } from "lucide-react";
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

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.45, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

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
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div {...anim(0)} className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus produtos digitais
          </p>
        </div>
        <Button className="gap-2 rounded-xl" asChild>
          <Link to="/products/new">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Novo Produto
          </Link>
        </Button>
      </motion.div>

      {/* Breadcrumb */}
      <motion.div {...anim(0.04)} className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <span className="hover:text-foreground transition-colors cursor-pointer">Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Meus Produtos</span>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : myProducts.length === 0 ? (
        <motion.div {...anim(0.08)} className="rounded-2xl border border-dashed border-border bg-card p-16 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold">Nenhum produto criado ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro produto digital e comece a vender</p>
          </div>
          <Button className="gap-2 rounded-xl" asChild>
            <Link to="/products/new">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Criar primeiro produto
            </Link>
          </Button>
        </motion.div>
      ) : (
        <motion.div {...anim(0.08)} className="space-y-3">
          {myProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer overflow-hidden"
              onClick={() => navigate(`/products/${product.id}/edit`)}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Cover */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted/30 shrink-0">
                  {product.cover_url ? (
                    <img src={product.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold truncate">{product.title}</h3>
                    <Badge variant="secondary" className={`text-[0.6rem] shrink-0 ${product.is_published ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}`}>
                      {product.is_published ? "Ativo" : "Rascunho"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{product.type === "lms" ? "Área de Membros" : "Download"}</p>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary">R$ {(product.price / 100).toFixed(2)}</p>
                    <p className="text-[0.6rem] text-muted-foreground uppercase tracking-widest">Preço</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-lg font-bold">{salesCounts[product.id] || 0}</span>
                    </div>
                    <p className="text-[0.6rem] text-muted-foreground uppercase tracking-widest">Vendas</p>
                  </div>
                  {(pixelCounts[product.id] ?? []).length > 0 && (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Radio className="h-3.5 w-3.5 text-primary" />
                        <span className="text-lg font-bold text-primary">{pixelCounts[product.id].length}</span>
                      </div>
                      <p className="text-[0.6rem] text-muted-foreground uppercase tracking-widest">Pixels</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl shrink-0"
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
                    <DropdownMenuItem className="gap-2 text-sm text-destructive" onClick={() => setDeleteId(product.id)}>
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile stats */}
              <div className="flex sm:hidden items-center gap-4 px-4 pb-4 pt-0">
                <span className="text-sm font-bold text-primary">R$ {(product.price / 100).toFixed(2)}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShoppingCart className="h-3 w-3" />
                  {salesCounts[product.id] || 0} vendas
                </div>
                {(pixelCounts[product.id] ?? []).length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Radio className="h-3 w-3" />
                    {pixelCounts[product.id].length} pixels
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
