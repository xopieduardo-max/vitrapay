import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Settings,
  Tag,
  Link2,
  Plus,
  Trash2,
  Eye,
} from "lucide-react";

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Product data
  const { data: product, isLoading } = useQuery({
    queryKey: ["edit-product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  // Form state (initialized from product)
  const [form, setForm] = useState<Record<string, any>>({});

  // Initialize form when product loads
  const initialized = form._initialized;
  if (product && !initialized) {
    setForm({
      _initialized: true,
      title: product.title,
      description: product.description || "",
      price: String(product.price / 100),
      type: product.type,
      affiliate_commission: product.affiliate_commission || 0,
      is_published: product.is_published || false,
      checkout_headline: product.checkout_headline || "",
      checkout_timer_minutes: product.checkout_timer_minutes || 0,
    });
  }

  // Coupons
  const { data: coupons = [] } = useQuery({
    queryKey: ["product-coupons", id, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("producer_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Checkout links (the main checkout + affiliate links)
  const checkoutUrl = `${window.location.origin}/checkout/${id}`;

  const { data: affiliateLinks = [] } = useQuery({
    queryKey: ["product-affiliates", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliates")
        .select("id, affiliate_link, clicks, user_id")
        .eq("product_id", id!);

      if (!data?.length) return [];

      const userIds = data.map((a) => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));

      return data.map((a) => ({
        ...a,
        affiliateName: profileMap.get(a.user_id) || "Afiliado",
      }));
    },
    enabled: !!id,
  });

  const updateField = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          title: form.title,
          description: form.description,
          price: Math.round(parseFloat(form.price) * 100),
          type: form.type,
          affiliate_commission: form.affiliate_commission,
          is_published: form.is_published,
          checkout_headline: form.checkout_headline,
          checkout_timer_minutes: form.checkout_timer_minutes,
        })
        .eq("id", product.id);

      if (error) throw error;
      toast({ title: "Produto atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["edit-product", id] });
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({ title: "Link copiado!" });
  };

  // Coupon creation
  const [newCoupon, setNewCoupon] = useState({ code: "", discount_value: "", discount_type: "percentage", max_uses: "" });
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  const handleCreateCoupon = async () => {
    if (!user || !newCoupon.code || !newCoupon.discount_value) return;
    setCreatingCoupon(true);
    try {
      const { error } = await supabase.from("coupons").insert({
        code: newCoupon.code.toUpperCase(),
        discount_value: parseInt(newCoupon.discount_value),
        discount_type: newCoupon.discount_type,
        max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null,
        producer_id: user.id,
      });
      if (error) throw error;
      toast({ title: "Cupom criado!" });
      setNewCoupon({ code: "", discount_value: "", discount_type: "percentage", max_uses: "" });
      queryClient.invalidateQueries({ queryKey: ["product-coupons"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCreatingCoupon(false);
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
      <div className="text-center py-20">
        <p className="text-muted-foreground">Produto não encontrado</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="space-y-6 pb-20 md:pb-6 max-w-4xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{product.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={product.is_published ? "default" : "secondary"} className="text-[0.6rem]">
                {product.is_published ? "Ativo" : "Rascunho"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {product.type === "lms" ? "Área de Membros" : "Download"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(checkoutUrl, "_blank")}>
            <Eye className="h-3.5 w-3.5" /> Visualizar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-6">
          <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-0 gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="coupons" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-0 gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Cupons
          </TabsTrigger>
          <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-0 gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Links
          </TabsTrigger>
        </TabsList>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Título do produto</Label>
                <Input value={form.title || ""} onChange={(e) => updateField("title", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={form.description || ""} onChange={(e) => updateField("description", e.target.value)} rows={4} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input type="number" step="0.01" value={form.price || ""} onChange={(e) => updateField("price", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select
                    value={form.type || "download"}
                    onChange={(e) => updateField("type", e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="download">Download</option>
                    <option value="lms">Área de Membros</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs">Comissão de afiliado: {form.affiliate_commission || 0}%</Label>
                <Slider
                  value={[form.affiliate_commission || 0]}
                  onValueChange={([v]) => updateField("affiliate_commission", v)}
                  max={80}
                  step={5}
                  className="mt-3"
                />
              </div>
              <div>
                <Label className="text-xs">Headline do checkout</Label>
                <Input value={form.checkout_headline || ""} onChange={(e) => updateField("checkout_headline", e.target.value)} className="mt-1" placeholder="Ex: TOP 1 EM VENDAS" />
              </div>
              <div>
                <Label className="text-xs">Timer de urgência (minutos)</Label>
                <Input type="number" value={form.checkout_timer_minutes || 0} onChange={(e) => updateField("checkout_timer_minutes", parseInt(e.target.value) || 0)} className="mt-1" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm font-medium">Publicado</Label>
                  <p className="text-[0.65rem] text-muted-foreground">Visível nas Oportunidades</p>
                </div>
                <Switch checked={form.is_published || false} onCheckedChange={(v) => updateField("is_published", v)} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* CUPONS */}
        <TabsContent value="coupons" className="mt-6 space-y-6">
          {/* Create coupon */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold">Criar novo cupom</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Código</Label>
                <Input
                  placeholder="DESCONTO10"
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon((c) => ({ ...c, discount_value: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <select
                  value={newCoupon.discount_type}
                  onChange={(e) => setNewCoupon((c) => ({ ...c, discount_type: e.target.value }))}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="percentage">Percentual (%)</option>
                  <option value="fixed">Fixo (centavos)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Máx. usos</Label>
                <Input
                  type="number"
                  placeholder="Ilimitado"
                  value={newCoupon.max_uses}
                  onChange={(e) => setNewCoupon((c) => ({ ...c, max_uses: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <Button size="sm" className="gap-1.5" onClick={handleCreateCoupon} disabled={creatingCoupon}>
              {creatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Criar Cupom
            </Button>
          </div>

          {/* Existing coupons */}
          {coupons.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px_80px_60px] gap-3 px-4 py-3 border-b border-border text-[0.6rem] uppercase tracking-widest text-muted-foreground font-medium">
                <span>Código</span>
                <span>Desconto</span>
                <span>Usos</span>
                <span>Status</span>
                <span></span>
              </div>
              {coupons.map((coupon: any) => (
                <div key={coupon.id} className="grid grid-cols-[1fr_100px_80px_80px_60px] gap-3 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-mono font-bold">{coupon.code}</span>
                  <span className="text-sm">
                    {coupon.discount_type === "percentage"
                      ? `${coupon.discount_value}%`
                      : `R$ ${(coupon.discount_value / 100).toFixed(2)}`}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {coupon.uses || 0}{coupon.max_uses ? `/${coupon.max_uses}` : ""}
                  </span>
                  <Badge variant={coupon.is_active ? "default" : "secondary"} className="text-[0.6rem] w-fit">
                    {coupon.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  <span />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LINKS */}
        <TabsContent value="links" className="mt-6 space-y-6">
          {/* Main checkout link */}
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

          {/* Affiliate links table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold">Links de Afiliados</h3>
              <span className="text-xs text-muted-foreground">{affiliateLinks.length} afiliado(s)</span>
            </div>
            {affiliateLinks.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum afiliado ainda
              </div>
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
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
