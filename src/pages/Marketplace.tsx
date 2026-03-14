import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { mockProducts } from "@/lib/mockData";
import { useState } from "react";

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const filtered = mockProducts.filter((p) =>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((product, i) => (
          <ProductCard key={product.id} {...product} index={i} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}
