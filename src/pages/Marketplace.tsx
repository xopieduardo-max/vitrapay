import { Search, SlidersHorizontal, Loader2, Flame, Rocket, TrendingUp, Sparkles, Star, ChevronRight, ShoppingBag, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { ProductDrawer } from "@/components/ProductDrawer";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import marketplaceBanner from "@/assets/marketplace-banner.png";
import BannerCarousel from "@/components/BannerCarousel";
import { useNavigate } from "react-router-dom";

type Tab = "all" | "trending" | "top_commission" | "newest";

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "Todos", icon: null },
  { key: "trending", label: "Em alta", icon: <Flame className="h-3.5 w-3.5" /> },
  { key: "top_commission", label: "Mais lucrativos", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "newest", label: "Novidades", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.45, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
});

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const navigate = useNavigate();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, title, description, price, cover_url, type, affiliate_commission, producer_id, created_at")
        .eq("is_published", true)
        .eq("allow_affiliates", true)
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

  const searched = products.filter((p: any) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

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

  const trending = [...products]
    .sort((a: any, b: any) => b.salesCount - a.salesCount)
    .slice(0, 4);

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Banner Carousel */}
      <motion.div {...anim(0)}>
        <BannerCarousel
          location="marketplace"
          fallbackSrc={marketplaceBanner}
          fallbackAlt="Banner Oportunidades"
          maxHeight={140}
        />
      </motion.div>

      {/* Premium Header */}
      <motion.div {...anim(0.04)} className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descubra produtos digitais para vender como afiliado ou comprar
        </p>
      </motion.div>

      {/* Breadcrumb */}
      <motion.div {...anim(0.06)} className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <span className="hover:text-foreground transition-colors cursor-pointer">Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Marketplace</span>
      </motion.div>

      {/* Tabs + Search */}
      <motion.div {...anim(0.08)} className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
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
              className="pl-9 bg-muted/30 border-border/50 rounded-xl h-9"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 h-9 w-9 rounded-xl">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </motion.div>

      {/* Trending Section */}
      {activeTab === "all" && trending.length > 0 && !search && (
        <motion.div {...anim(0.12)} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Rocket className="h-4 w-4 text-primary" />
              </div>
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
                onClick={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Divider if trending shown */}
      {activeTab === "all" && trending.length > 0 && !search && (
        <motion.div {...anim(0.16)} className="border-t border-border" />
      )}

      {/* All Products */}
      <motion.div {...anim(0.18)}>
        {activeTab === "all" && !search && (
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-primary" />
            </div>
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
                onClick={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        )}

        {/* Premium Empty State */}
        {!isLoading && filtered.length === 0 && (
          <motion.div {...anim(0.2)} className="rounded-2xl border border-dashed border-border bg-card p-16 text-center space-y-5">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold">
                {search ? "Nenhum produto encontrado" : "O Marketplace está vazio por enquanto"}
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {search
                  ? `Não encontramos resultados para "${search}". Tente outra busca ou explore todas as categorias.`
                  : "Em breve novos produtos estarão disponíveis para você se afiliar e começar a vender. Enquanto isso, crie o seu próprio produto!"}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              {search ? (
                <Button className="gap-2 rounded-xl" onClick={() => setSearch("")}>
                  <Search className="h-4 w-4" /> Limpar busca
                </Button>
              ) : (
                <>
                  <Button className="gap-2 rounded-xl" onClick={() => navigate("/products/new")}>
                    <Package className="h-4 w-4" /> Criar meu produto
                  </Button>
                  <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setActiveTab("all")}>
                    <Sparkles className="h-4 w-4" /> Explorar novidades
                  </Button>
                </>
              )}
            </div>

            {/* Visual decorative stats */}
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto pt-4">
              {[
                { label: "Produtos", value: "Em breve", icon: Package },
                { label: "Afiliados", value: "Ativo", icon: TrendingUp },
                { label: "Comissões", value: "Até 80%", icon: Flame },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center">
                  <stat.icon className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-xs font-bold text-primary">{stat.value}</p>
                  <p className="text-[0.6rem] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Product Drawer */}
      <ProductDrawer
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
