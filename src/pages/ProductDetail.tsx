import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  BookOpen,
  Users,
  Star,
  ShoppingCart,
  Flame,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [affiliating, setAffiliating] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", id!)
        .maybeSingle();

      if (!data) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.producer_id)
        .maybeSingle();

      // Get sales count
      const { count } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id!)
        .eq("status", "completed");

      return {
        ...data,
        producerName: profile?.display_name || "Produtor",
        salesCount: count || 0,
      };
    },
    enabled: !!id,
  });

  // Check if user is already affiliated
  const { data: existingAffiliation } = useQuery({
    queryKey: ["affiliation-check", id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("affiliates")
        .select("id, affiliate_link")
        .eq("product_id", id!)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user,
  });

  const handleAffiliate = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setAffiliating(true);
    try {
      // Insert and get the record ID to use as ref
      const { data: newAff, error } = await supabase.from("affiliates").insert({
        product_id: id!,
        user_id: user.id,
        affiliate_link: "", // placeholder, will update below
      }).select("id").single();
      if (error) throw error;
      
      // Use the affiliate record ID as the ref parameter
      const affiliateLink = `${window.location.origin}/checkout/${id}?ref=${newAff.id}`;
      await supabase.from("affiliates").update({ affiliate_link: affiliateLink }).eq("id", newAff.id);
      
      toast({ title: "Afiliação realizada!", description: "Seu link de afiliado está pronto." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setAffiliating(false);
    }
  };

  const handleCopyLink = () => {
    if (existingAffiliation?.affiliate_link) {
      navigator.clipboard.writeText(existingAffiliation.affiliate_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copiado!" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Produto não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/marketplace")}>
          Voltar às Oportunidades
        </Button>
      </div>
    );
  }

  const temp = Math.min(product.salesCount, 200);
  const commission = product.affiliate_commission || 0;
  const commissionValue = (product.price / 100) * (commission / 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-6"
    >
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Voltar às Oportunidades
      </Link>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Left: Cover + Info */}
        <div className="md:col-span-3 space-y-6">
          {/* Cover */}
          <div className="aspect-[16/9] rounded-xl overflow-hidden bg-muted/30 relative">
            {product.cover_url ? (
              <img
                src={product.cover_url}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : product.type === "download" ? (
              <div className="flex items-center justify-center h-full">
                <Download className="h-16 w-16 text-foreground/15" strokeWidth={1.5} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <BookOpen className="h-16 w-16 text-foreground/15" strokeWidth={1.5} />
              </div>
            )}
            {/* Temperature */}
            {product.salesCount > 0 && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Flame className="h-4 w-4 text-destructive" strokeWidth={2} />
                <span className="text-sm font-bold">{temp}°</span>
                <span>{temp >= 100 ? "🔥" : temp >= 50 ? "⚡" : "🚀"}</span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {product.type === "download" ? "Download Digital" : "Área de Membros"}
              </Badge>
              {commission > 0 && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
                  <Users className="h-3 w-3" strokeWidth={1.5} />
                  {commission}% de comissão
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight">{product.title}</h1>
            <p className="text-sm text-muted-foreground">Por {product.producerName}</p>

            {product.description && (
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-2">Sobre o produto</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-lg font-bold">{product.salesCount}</p>
                <p className="text-[0.6rem] text-muted-foreground">Vendas</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-lg font-bold">{commission}%</p>
                <p className="text-[0.6rem] text-muted-foreground">Comissão</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <Star className="h-4 w-4 mx-auto mb-1 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-lg font-bold">4.8</p>
                <p className="text-[0.6rem] text-muted-foreground">Avaliação</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Pricing + Affiliate CTA */}
        <div className="md:col-span-2 space-y-4">
          {/* Price Card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5 sticky top-6">
            <div>
              <p className="text-xs text-muted-foreground">Preço do produto</p>
              <p className="text-3xl font-bold mt-1">
                R$ {(product.price / 100).toFixed(2)}
              </p>
            </div>

            {commission > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3 text-primary" /> Você recebe por venda
                </p>
                <p className="text-2xl font-bold text-primary">
                  R$ {commissionValue.toFixed(2)}
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  {commission}% de comissão sobre cada venda
                </p>
              </div>
            )}

            {/* Affiliate Actions */}
            {existingAffiliation ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground mb-1">
                    Seu link de afiliado
                  </p>
                  <p className="text-xs text-foreground break-all font-mono">
                    {existingAffiliation.affiliate_link}
                  </p>
                </div>
                <Button className="w-full gap-2" onClick={handleCopyLink}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copiar Link de Afiliado
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full h-12 text-base font-semibold gap-2"
                  onClick={handleAffiliate}
                  disabled={affiliating || product.producer_id === user?.id}
                >
                  {affiliating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  {product.producer_id === user?.id
                    ? "Você é o produtor"
                    : "Tornar-se Afiliado"
                  }
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate(`/checkout/${id}`)}
                >
                  <ShoppingCart className="h-4 w-4" /> Comprar Produto
                </Button>
              </div>
            )}

            <div className="border-t border-border pt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
              Pagamento seguro. Acesso imediato após confirmação.
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
