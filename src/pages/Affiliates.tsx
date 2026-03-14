import {
  Copy,
  Check,
  Link2,
  TrendingUp,
  DollarSign,
  MousePointer,
  Loader2,
  ExternalLink,
  ShoppingCart,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Affiliates() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  // Fetch user's affiliations with product info
  const { data: affiliations = [], isLoading } = useQuery({
    queryKey: ["my-affiliations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: affs } = await supabase
        .from("affiliates")
        .select("id, affiliate_link, clicks, product_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!affs?.length) return [];

      // Fetch product details
      const productIds = [...new Set(affs.map((a) => a.product_id))];
      const { data: products } = await supabase
        .from("products")
        .select("id, title, price, cover_url, type, affiliate_commission, producer_id")
        .in("id", productIds);

      // Fetch producer names
      const producerIds = [...new Set((products || []).map((p) => p.producer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", producerIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));
      const productMap = new Map((products || []).map((p) => [p.id, p]));

      // Fetch commissions for this user
      const { data: commissions } = await supabase
        .from("commissions")
        .select("affiliate_id, amount, status")
        .eq("affiliate_id", user.id);

      const commissionByProduct = new Map<string, { total: number; count: number }>();
      // Map commissions through sales to products (simplified - aggregate all)
      const totalEarnings = (commissions || [])
        .filter((c) => c.status === "completed" || c.status === "pending")
        .reduce((acc, c) => acc + c.amount, 0);

      return affs.map((a) => {
        const product = productMap.get(a.product_id);
        return {
          ...a,
          product,
          producerName: product ? profileMap.get(product.producer_id) || "Produtor" : "Produtor",
        };
      });
    },
    enabled: !!user,
  });

  // Stats
  const { data: stats = { clicks: 0, earnings: 0, conversions: 0 } } = useQuery({
    queryKey: ["affiliate-stats", user?.id],
    queryFn: async () => {
      if (!user) return { clicks: 0, earnings: 0, conversions: 0 };

      const totalClicks = affiliations.reduce((acc, a) => acc + (a.clicks || 0), 0);

      const { data: commissions } = await supabase
        .from("commissions")
        .select("amount, status")
        .eq("affiliate_id", user.id);

      const completed = (commissions || []).filter((c) => c.status === "completed");
      const totalEarnings = completed.reduce((acc, c) => acc + c.amount, 0);

      return {
        clicks: totalClicks,
        earnings: totalEarnings,
        conversions: completed.length,
      };
    },
    enabled: !!user && affiliations.length > 0,
  });

  const handleCopy = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const fmt = (v: number) =>
    `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minhas Afiliações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus produtos afiliados, links e comissões
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate("/marketplace")}>
          <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
          Encontrar Produtos
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Cliques", value: stats.clicks.toLocaleString(), icon: MousePointer },
          { title: "Conversões", value: stats.conversions.toLocaleString(), icon: TrendingUp },
          { title: "Comissão Total", value: fmt(stats.earnings), icon: DollarSign },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{stat.title}</p>
              <stat.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-2xl font-bold mt-2">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Affiliations List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : affiliations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <p className="text-muted-foreground">Você ainda não se afiliou a nenhum produto.</p>
          <Button className="gap-2" onClick={() => navigate("/marketplace")}>
            <ShoppingCart className="h-4 w-4" /> Explorar Oportunidades
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {affiliations.map((aff: any, i: number) => {
            const product = aff.product;
            if (!product) return null;
            const commission = product.affiliate_commission || 0;
            const commissionValue = (product.price / 100) * (commission / 100);

            return (
              <motion.div
                key={aff.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.2, 0, 0, 1] }}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Cover */}
                  {product.cover_url && (
                    <img
                      src={product.cover_url}
                      alt={product.title}
                      className="h-16 w-16 rounded-lg object-cover shrink-0"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold">{product.title}</h3>
                        <p className="text-xs text-muted-foreground">Por {aff.producerName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[0.6rem]">
                          {commission}% comissão
                        </Badge>
                        <Badge variant="outline" className="text-[0.6rem]">
                          {product.type === "download" ? "Download" : "LMS"}
                        </Badge>
                      </div>
                    </div>

                    {/* Link + Stats row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5">
                          <Link2 className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
                          <span className="text-xs text-muted-foreground truncate font-mono">
                            {aff.affiliate_link}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right px-3">
                          <p className="text-xs text-muted-foreground">{aff.clicks || 0} cliques</p>
                          <p className="text-xs font-bold text-primary">
                            R$ {commissionValue.toFixed(2)}/venda
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8 text-xs w-[90px]"
                          onClick={() => handleCopy(aff.affiliate_link, aff.id)}
                        >
                          <AnimatePresence mode="wait">
                            {copiedIdx === aff.id ? (
                              <motion.span key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-primary">
                                <Check className="h-3.5 w-3.5" /> Copiado
                              </motion.span>
                            ) : (
                              <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1">
                                <Copy className="h-3.5 w-3.5" /> Copiar
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(aff.affiliate_link, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
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
