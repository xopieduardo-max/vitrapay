import { useState } from "react";
import {
  Download,
  BookOpen,
  Users,
  Flame,
  ShoppingCart,
  Copy,
  Check,
  Loader2,
  Shield,
  Zap,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProductDrawerProps {
  product: {
    id: string;
    title: string;
    description?: string | null;
    price: number;
    cover_url?: string | null;
    type: string;
    affiliate_commission?: number | null;
    producer_id: string;
    producerName: string;
    salesCount: number;
  } | null;
  open: boolean;
  onClose: () => void;
}

export function ProductDrawer({ product, open, onClose }: ProductDrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [affiliating, setAffiliating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: affiliation, isLoading: checkingAffiliation } = useQuery({
    queryKey: ["affiliation-check", product?.id, user?.id],
    queryFn: async () => {
      if (!user || !product) return null;
      const { data } = await supabase
        .from("affiliates")
        .select("id, affiliate_link")
        .eq("product_id", product.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!product?.id && !!user && open,
  });

  if (!product) return null;

  const commission = product.affiliate_commission || 0;
  const commissionValue = (product.price / 100) * (commission / 100);
  const temp = Math.min(product.salesCount, 200);
  const isOwner = product.producer_id === user?.id;

  const handleAffiliate = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setAffiliating(true);
    try {
      // Insert and get the record ID to use as ref
      const { data: newAff, error } = await supabase.from("affiliates").insert({
        product_id: product.id,
        user_id: user.id,
        affiliate_link: "", // placeholder
      }).select("id").single();
      if (error) throw error;

      // Use the affiliate record ID as the ref parameter
      const affiliateLink = `${window.location.origin}/checkout/${product.id}?ref=${newAff.id}`;
      await supabase.from("affiliates").update({ affiliate_link: affiliateLink }).eq("id", newAff.id);

      toast({
        title: "✅ Solicitação enviada!",
        description: "Aguardando a aprovação do produtor.",
      });
      queryClient.invalidateQueries({ queryKey: ["affiliation-check", product.id] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setAffiliating(false);
    }
  };

  const handleCopyLink = () => {
    if (affiliation?.affiliate_link) {
      navigator.clipboard.writeText(affiliation.affiliate_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copiado!" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0 border-l border-border">
        {/* Cover */}
        <div className="relative">
          <div className="aspect-[16/10] w-full bg-muted/30 overflow-hidden">
            {product.cover_url ? (
              <img src={product.cover_url} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full">
                {product.type === "download" ? (
                  <Download className="h-12 w-12 text-foreground/15" />
                ) : (
                  <BookOpen className="h-12 w-12 text-foreground/15" />
                )}
              </div>
            )}
          </div>
          {product.salesCount > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
              <Flame className="h-3.5 w-3.5 text-destructive" strokeWidth={2} />
              <span className="text-xs font-bold">{temp}°</span>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold tracking-tight">{product.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Por {product.producerName}</p>

          {/* Affiliate CTA */}
          <div className="mt-4">
            {affiliation ? (
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Pendente
                </Badge>
                <div className="rounded-lg bg-muted/50 p-3 mt-2">
                  <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground mb-1">
                    Seu link de afiliado
                  </p>
                  <p className="text-[0.65rem] text-foreground break-all font-mono">
                    {affiliation.affiliate_link}
                  </p>
                </div>
                <Button size="sm" className="w-full gap-1.5" onClick={handleCopyLink}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado!" : "Copiar Link"}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={handleAffiliate}
                disabled={affiliating || isOwner || checkingAffiliation}
              >
                {affiliating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                {isOwner ? "Você é o produtor" : "Solicitar Afiliação"}
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-2" />

        {/* Tabs: Produto / Detalhes / Ofertas */}
        <div className="px-5 pb-8">
          <Tabs defaultValue="produto" className="w-full">
            <TabsList className="w-full bg-transparent border-b border-border rounded-none h-auto p-0 gap-4">
              <TabsTrigger
                value="produto"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 px-0 text-xs"
              >
                Produto
              </TabsTrigger>
              <TabsTrigger
                value="detalhes"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 px-0 text-xs"
              >
                Detalhes
              </TabsTrigger>
              <TabsTrigger
                value="ofertas"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 px-0 text-xs"
              >
                Ofertas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="produto" className="mt-4 space-y-4">
              <div className="space-y-3">
                <InfoRow label="Tipo" value={product.type === "download" ? "Download Digital" : "Área de Membros"} />
                {commission > 0 && (
                  <InfoRow
                    label="Receba até"
                    value={`R$ ${commissionValue.toFixed(2)}`}
                    highlight
                  />
                )}
                {commission > 0 && (
                  <InfoRow label="Percentual de comissão" value={`${commission}%`} />
                )}
                <InfoRow label="Preço" value={`R$ ${(product.price / 100).toFixed(2)}`} />
                <InfoRow label="Vendas" value={`${product.salesCount}`} />
              </div>

              {product.description && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-primary mb-1.5">Descrição</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="detalhes" className="mt-4 space-y-3">
              <InfoRow label="Atribuição" value="Último clique" />
              <InfoRow label="Duração dos cookies" value="30 dias" />
              <InfoRow label="Compartilhar bump" value="Sim" />
              <InfoRow label="Contrato do afiliado" value="Sim" />
              <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Pagamento seguro. Acesso imediato após confirmação.
              </div>
            </TabsContent>

            <TabsContent value="ofertas" className="mt-4">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-3 gap-0 bg-muted/30 px-3 py-2 text-[0.6rem] uppercase tracking-widest text-muted-foreground font-medium">
                  <span>Nome</span>
                  <span className="text-center">Preço</span>
                  <span className="text-right">Você recebe</span>
                </div>
                <div className="grid grid-cols-3 gap-0 px-3 py-3 items-center border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium truncate">{product.title}</span>
                  </div>
                  <span className="text-xs text-center">R$ {(product.price / 100).toFixed(2)}</span>
                  <span className="text-xs text-right font-bold text-primary">
                    R$ {commissionValue.toFixed(2)}
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium ${highlight ? "text-primary font-bold" : ""}`}>
        {value}
      </span>
    </div>
  );
}
