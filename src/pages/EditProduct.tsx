import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Loader2, Copy, Check, ExternalLink,
  Settings, Tag, Link2, Eye, Plus, Trash2, Star,
  ShoppingCart, MessageSquareQuote, BarChart3,
} from "lucide-react";

// ── Sub-components ──
import EditProductSettings from "@/components/edit-product/EditProductSettings";
import EditProductCoupons from "@/components/edit-product/EditProductCoupons";
import EditProductLinks from "@/components/edit-product/EditProductLinks";
import EditProductCheckout from "@/components/edit-product/EditProductCheckout";
import EditProductPixels from "@/components/edit-product/EditProductPixels";

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["edit-product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const [form, setForm] = useState<Record<string, any>>({});
  if (product && !form._initialized) {
    setForm({
      _initialized: true,
      title: product.title,
      description: product.description || "",
      price: String(product.price / 100),
      type: product.type,
      affiliate_commission: product.affiliate_commission || 0,
      is_published: product.is_published || false,
      cover_url: product.cover_url || "",
      file_url: product.file_url || "",
      checkout_headline: product.checkout_headline || "",
      checkout_timer_minutes: product.checkout_timer_minutes || 0,
      checkout_banner_url: product.checkout_banner_url || "",
    });
  }

  const updateField = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

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
          cover_url: form.cover_url || null,
          file_url: form.file_url || null,
          checkout_headline: form.checkout_headline,
          checkout_timer_minutes: form.checkout_timer_minutes,
          checkout_banner_url: form.checkout_banner_url,
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

  const checkoutUrl = `${window.location.origin}/checkout/${id}`;

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
        <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-4 overflow-x-auto flex-nowrap">
          {[
            { value: "settings", icon: Settings, label: "Geral" },
            { value: "checkout", icon: ShoppingCart, label: "Checkout" },
            { value: "pixels", icon: BarChart3, label: "Pixels" },
            { value: "coupons", icon: Tag, label: "Cupons" },
            { value: "links", icon: Link2, label: "Afiliados" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-0 gap-1.5 whitespace-nowrap shrink-0"
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="settings" className="mt-6">
          <EditProductSettings form={form} updateField={updateField} />
        </TabsContent>

        <TabsContent value="checkout" className="mt-6">
          <EditProductCheckout
            productId={id!}
            form={form}
            updateField={updateField}
            checkoutUrl={checkoutUrl}
          />
        </TabsContent>

        <TabsContent value="pixels" className="mt-6">
          <EditProductPixels productId={id!} />
        </TabsContent>

        <TabsContent value="coupons" className="mt-6">
          <EditProductCoupons userId={user?.id} />
        </TabsContent>

        <TabsContent value="links" className="mt-6">
          <EditProductLinks productId={id!} checkoutUrl={checkoutUrl} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
