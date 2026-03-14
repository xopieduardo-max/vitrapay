import { Search, SlidersHorizontal, Loader2, Flame, Rocket, TrendingUp, Sparkles, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { ProductDrawer } from "@/components/ProductDrawer";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import marketplaceBanner from "@/assets/marketplace-banner.png";

type Tab = "all" | "trending" | "top_commission" | "newest";

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "Todos", icon: null },
  { key: "trending", label: "Em alta", icon: <Flame className="h-3.5 w-3.5" /> },
  { key: "top_commission", label: "Mais lucrativos", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "newest", label: "Novidades", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 10 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.4, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, title, description, price, cover_url, type, affiliate_commission, producer_id, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!prods?.length) return [];

      const producerIds = [...new Set(prods.map((p) => p.producer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", producerIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.display_name])
      );

      // Fetch sales count per product for "temperature"
      const { data: salesData } = await supabase
        .from("sales")
        .select("product_id, status")
        .eq("status", "completed");

      const salesCount = new Map<string, number>();
      (salesData || []).forEach((s) => {
        if (s.product_id) {
          salesCount.set(s.product_id, (salesCount.get(s.product_id) || 0) + 1);
        }
      });

      return prods.map((p) => ({
        ...p,
        producerName: profileMap.get(p.producer_id) || "Produtor",
        salesCount: salesCount.get(p.id) || 0,
      }));
    },
  });

  // Filter by search
  const searched = products.filter((p: any) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  // Sort/filter by tab
  const filtered = (() => {
    switch (activeTab) {
      case "trending":
        return [...searched].sort((a: any, b: any) => b.salesCount - a.salesCount);
      case "top_commission":
        return [...searched].sort((a: any, b: any) => (b.affiliate_commission || 0) - (a.affiliate_commission || 0));
      case "newest":
        return [...searched].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      default:
        return searched;
    }
  })();

  // Top 4 trending for the highlight section
  const trending = [...products]
    .sort((a: any, b: any) => b.salesCount - a.salesCount)
    .slice(0, 4);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Banner */}
      <motion.div {...anim(0)} className="rounded-xl overflow-hidden">
        <img
          src={marketplaceBanner}
          alt="Banner Oportunidades"
          className="w-full h-auto object-cover rounded-xl"
          style={{ maxHeight: 140 }}
        />
      </motion.div>

      {/* Header */}
      <motion.div {...anim(0.05)}>
        <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descubra produtos digitais para vender como afiliado ou comprar
        </p>
      </motion.div>

      {/* Tabs + Search */}
      <motion.div {...anim(0.1)} className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="O que você está buscando?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-transparent focus:border-border h-9"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </motion.div>

      {/* Trending Section */}
      {activeTab === "all" && trending.length > 0 && !search && (
        <motion.div {...anim(0.15)} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              Mais quentes da plataforma
              <span className="text-lg">🔥</span>
            </h2>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((product: any, i: number) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                producer={product.producerName}
                price={product.price}
                coverUrl={product.cover_url}
                type={product.type as "download" | "lms"}
                commission={product.affiliate_commission || 0}
                salesCount={product.salesCount}
                index={i}
                featured
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Divider if trending shown */}
      {activeTab === "all" && trending.length > 0 && !search && (
        <motion.div {...anim(0.2)} className="border-t border-border" />
      )}

      {/* All Products */}
      <motion.div {...anim(0.25)}>
        {activeTab === "all" && !search && (
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Todos os produtos
          </h2>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                salesCount={product.salesCount}
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
      </motion.div>
    </div>
  );
}
