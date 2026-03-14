import { Download, BookOpen, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function BuyerLibrary() {
  const { user } = useAuth();

  const { data: accessItems = [], isLoading } = useQuery({
    queryKey: ["buyer-library", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("product_access")
        .select("id, product_id, granted_at, products(id, title, type, cover_url, file_url, producer_id, profiles!inner(display_name))")
        .eq("user_id", user.id)
        .order("granted_at", { ascending: false });
      return data || [];
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
            const product = item.products;
            if (!product) return null;
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {product.profiles?.display_name || "Produtor"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[0.65rem]">
                      {product.type === "download" ? "Download" : "Curso"}
                    </Badge>
                    {product.type === "download" ? (
                      product.file_url ? (
                        <Button size="sm" className="gap-1.5 h-8 text-xs" asChild>
                          <a href={product.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Baixar
                          </a>
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
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
