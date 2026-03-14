import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Marketplace() {
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, title, description, price, cover_url, type, affiliate_commission, producer_id")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!prods?.length) return [];

      // Get unique producer IDs and fetch their profiles
      const producerIds = [...new Set(prods.map((p) => p.producer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", producerIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.display_name])
      );

      return prods.map((p) => ({
        ...p,
        producerName: profileMap.get(p.producer_id) || "Produtor",
      }));
    },
  });

  const filtered = products.filter((p: any) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descubra produtos digitais para vender ou comprar
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-transparent focus:border-border"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0">
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product: any, i: number) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.title}
              producer={product.producerName}
              price={product.price}
              coverUrl={product.cover_url}
              type={product.type as "download" | "lms"}
              commission={product.affiliate_commission || 0}
              index={i}
            />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}
