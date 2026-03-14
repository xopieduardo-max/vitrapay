import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, ExternalLink } from "lucide-react";

interface Props {
  productId: string;
  checkoutUrl: string;
}

export default function EditProductLinks({ productId, checkoutUrl }: Props) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const { data: affiliateLinks = [] } = useQuery({
    queryKey: ["product-affiliates", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliates")
        .select("id, affiliate_link, clicks, user_id")
        .eq("product_id", productId);
      if (!data?.length) return [];
      const userIds = data.map((a) => a.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));
      return data.map((a) => ({ ...a, affiliateName: profileMap.get(a.user_id) || "Afiliado" }));
    },
    enabled: !!productId,
  });

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({ title: "Link copiado!" });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-bold">Link do Checkout Principal</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs font-mono truncate">{checkoutUrl}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => handleCopy(checkoutUrl)}>
            {copiedLink === checkoutUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLink === checkoutUrl ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => window.open(checkoutUrl, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold">Links de Afiliados</h3>
          <span className="text-xs text-muted-foreground">{affiliateLinks.length} afiliado(s)</span>
        </div>
        {affiliateLinks.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum afiliado ainda</div>
        ) : (
          <div className="divide-y divide-border">
            {affiliateLinks.map((aff: any) => (
              <div key={aff.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{aff.affiliateName}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{aff.affiliate_link}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-xs text-muted-foreground">{aff.clicks || 0} cliques</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleCopy(aff.affiliate_link)}>
                    {copiedLink === aff.affiliate_link ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copiar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
