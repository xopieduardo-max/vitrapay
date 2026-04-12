import { useState } from "react";
import { Download, BookOpen, Play, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { downloadFile } from "@/lib/downloadFile";

export default function BuyerLibrary() {
  const { user } = useAuth();
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const { data: accessItems = [], isLoading } = useQuery({
    queryKey: ["buyer-library", user?.id, user?.email],
    queryFn: async () => {
      if (!user) return [];

      const { data: accessById } = await supabase
        .from("product_access")
        .select("id, product_id, granted_at, sale_id")
        .eq("user_id", user.id)
        .order("granted_at", { ascending: false });

      const { data: accessByEmail } = await supabase
        .from("product_access")
        .select("id, product_id, granted_at, sale_id")
        .eq("buyer_email", user.email!)
        .order("granted_at", { ascending: false });

      const allAccess = [...(accessById || []), ...(accessByEmail || [])];
      const seen = new Set<string>();
      const access = allAccess.filter((a) => {
        if (seen.has(a.product_id)) return false;
        seen.add(a.product_id);
        return true;
      });

      if (!access.length) return [];

      const emailOnly = (accessByEmail || []).filter(
        (a: any) => !a.user_id || a.user_id !== user.id
      );
      if (emailOnly.length > 0) {
        for (const item of emailOnly) {
          await supabase
            .from("product_access")
            .update({ user_id: user.id })
            .eq("id", item.id);
        }
      }

      const productIds = access.map((a) => a.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, title, type, cover_url, file_url, producer_id")
        .in("id", productIds);

      if (!products?.length) return [];

      // Fetch product files
      const downloadProductIds = products.filter(p => p.type === "download").map(p => p.id);
      let productFilesMap: Record<string, any[]> = {};
      if (downloadProductIds.length > 0) {
        const { data: files } = await supabase
          .from("product_files")
          .select("*")
          .in("product_id", downloadProductIds)
          .order("position");
        if (files) {
          files.forEach((f: any) => {
            if (!productFilesMap[f.product_id]) productFilesMap[f.product_id] = [];
            productFilesMap[f.product_id].push(f);
          });
        }
      }

      const producerIds = [...new Set(products.map((p) => p.producer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", producerIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.display_name])
      );
      const productMap = new Map(products.map((p) => [p.id, p]));

      return access.map((a) => {
        const product = productMap.get(a.product_id);
        return {
          ...a,
          product: product
            ? {
                ...product,
                producerName: profileMap.get(product.producer_id) || "Produtor",
                files: productFilesMap[product.id] || [],
              }
            : null,
        };
      }).filter((a) => a.product);
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Minha Biblioteca</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acesse seus produtos comprados
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : accessItems.length === 0 ? (
        <div className="text-center py-20 text-sm text-muted-foreground">
          Você ainda não comprou nenhum produto.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accessItems.map((item: any, i: number) => {
            const product = item.product;
            const hasMultipleFiles = product.files && product.files.length > 1;
            const isExpanded = expandedProduct === product.id;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                <div className="aspect-video w-full flex items-center justify-center bg-muted/30 overflow-hidden">
                  {product.cover_url ? (
                    <img src={product.cover_url} alt={product.title} className="w-full h-full object-cover" />
                  ) : product.type === "download" ? (
                    <Download className="h-8 w-8 text-foreground/20" strokeWidth={1.5} />
                  ) : (
                    <BookOpen className="h-8 w-8 text-foreground/20" strokeWidth={1.5} />
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm tracking-title">{product.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.producerName}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[0.65rem]">
                      {product.type === "download" ? "Download" : "Curso"}
                    </Badge>
                    {product.type === "download" ? (
                      hasMultipleFiles ? (
                        <Button
                          size="sm"
                          variant={isExpanded ? "secondary" : "default"}
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {product.files.length} Arquivos
                        </Button>
                      ) : product.file_url ? (
                        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => downloadFile(product.files?.[0]?.file_url || product.file_url, product.title || "arquivo")}>
                            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Baixar
                        </Button>
                      ) : (
                        <Button size="sm" className="gap-1.5 h-8 text-xs" disabled>
                          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                          Indisponível
                        </Button>
                      )
                    ) : (
                      <Button size="sm" className="gap-1.5 h-8 text-xs" asChild>
                        <Link to={`/learn/${product.id}`}>
                          <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                          Acessar
                        </Link>
                      </Button>
                    )}
                  </div>

                  {/* Expanded files list */}
                  <AnimatePresence>
                    {isExpanded && hasMultipleFiles && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5 pt-2 border-t border-border"
                      >
                        {product.files.map((f: any) => (
                          <button
                            key={f.id}
                            onClick={() => downloadFile(f.file_url, f.file_name)}
                            className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/30 transition-colors w-full text-left"
                          >
                            <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
                            <span className="text-xs font-medium truncate flex-1">{f.file_name}</span>
                            <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
