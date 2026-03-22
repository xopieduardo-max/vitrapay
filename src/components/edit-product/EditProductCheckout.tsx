import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Star, Loader2, Copy, Check, ExternalLink, MessageSquareQuote, Paintbrush, Sun, Moon } from "lucide-react";

interface Props {
  productId: string;
  form: Record<string, any>;
  updateField: (field: string, value: any) => void;
  checkoutUrl: string;
}

export default function EditProductCheckout({ productId, form, updateField, checkoutUrl }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState(false);
  const [newTestimonial, setNewTestimonial] = useState({ author_name: "", content: "", rating: 5 });
  const [addingTestimonial, setAddingTestimonial] = useState(false);

  const { data: testimonials = [] } = useQuery({
    queryKey: ["checkout-testimonials", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkout_testimonials")
        .select("*")
        .eq("product_id", productId)
        .order("position", { ascending: true });
      return data || [];
    },
    enabled: !!productId,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(checkoutUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: "Link copiado!" });
  };

  const handleAddTestimonial = async () => {
    if (!newTestimonial.author_name || !newTestimonial.content) return;
    setAddingTestimonial(true);
    try {
      const { error } = await supabase.from("checkout_testimonials").insert({
        product_id: productId,
        author_name: newTestimonial.author_name,
        content: newTestimonial.content,
        rating: newTestimonial.rating,
        position: testimonials.length,
      });
      if (error) throw error;
      toast({ title: "Depoimento adicionado!" });
      setNewTestimonial({ author_name: "", content: "", rating: 5 });
      queryClient.invalidateQueries({ queryKey: ["checkout-testimonials", productId] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setAddingTestimonial(false);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    await supabase.from("checkout_testimonials").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["checkout-testimonials", productId] });
    toast({ title: "Depoimento removido" });
  };

  return (
    <div className="space-y-6">
      {/* Checkout Link + Builder Button */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Link do Checkout</h3>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/products/${productId}/checkout-builder`)}
          >
            <Paintbrush className="h-3.5 w-3.5" /> Editar Checkout
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs font-mono truncate">{checkoutUrl}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopy}>
            {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLink ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => window.open(checkoutUrl, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Tema do Checkout */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold">Tema do Checkout</h3>
        <p className="text-xs text-muted-foreground">Escolha se o checkout será exibido no modo claro ou escuro para seus compradores.</p>
        <div className="flex gap-3">
          <button
            onClick={() => updateField("checkout_theme", "light")}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all"
            style={{
              background: (form.checkout_theme || "light") === "light" ? "hsl(48, 96%, 53%)" : "hsl(var(--muted))",
              color: (form.checkout_theme || "light") === "light" ? "hsl(0,0%,10%)" : "hsl(var(--muted-foreground))",
              border: (form.checkout_theme || "light") === "light" ? "2px solid hsl(48, 96%, 48%)" : "2px solid hsl(var(--border))",
            }}
          >
            <Sun className="h-4 w-4" />
            Modo Claro
          </button>
          <button
            onClick={() => updateField("checkout_theme", "dark")}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all"
            style={{
              background: form.checkout_theme === "dark" ? "hsl(48, 96%, 53%)" : "hsl(var(--muted))",
              color: form.checkout_theme === "dark" ? "hsl(0,0%,10%)" : "hsl(var(--muted-foreground))",
              border: form.checkout_theme === "dark" ? "2px solid hsl(48, 96%, 48%)" : "2px solid hsl(var(--border))",
            }}
          >
            <Moon className="h-4 w-4" />
            Modo Escuro
          </button>
        </div>
      </div>


      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold">Personalizar Checkout</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Headline (barra superior)</Label>
            <Input
              value={form.checkout_headline || ""}
              onChange={(e) => updateField("checkout_headline", e.target.value)}
              placeholder="Ex: TOP 1 EM VENDAS"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Timer de urgência (minutos)</Label>
            <Input
              type="number"
              value={form.checkout_timer_minutes || 0}
              onChange={(e) => updateField("checkout_timer_minutes", parseInt(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">URL do Banner</Label>
            <Input
              value={form.checkout_banner_url || ""}
              onChange={(e) => updateField("checkout_banner_url", e.target.value)}
              placeholder="https://exemplo.com/banner.jpg"
              className="mt-1"
            />
            {form.checkout_banner_url && (
              <div className="mt-2 rounded-lg overflow-hidden max-h-32">
                <img src={form.checkout_banner_url} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Depoimentos */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <MessageSquareQuote className="h-4 w-4" /> Depoimentos do Checkout
          </h3>
          <span className="text-xs text-muted-foreground">{testimonials.length} depoimento(s)</span>
        </div>

        {/* Add new */}
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome do autor</Label>
              <Input
                value={newTestimonial.author_name}
                onChange={(e) => setNewTestimonial((t) => ({ ...t, author_name: e.target.value }))}
                placeholder="Maria Silva"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Avaliação</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setNewTestimonial((t) => ({ ...t, rating: star }))}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-5 w-5 ${star <= newTestimonial.rating ? "fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Depoimento</Label>
            <Textarea
              value={newTestimonial.content}
              onChange={(e) => setNewTestimonial((t) => ({ ...t, content: e.target.value }))}
              placeholder="Esse curso mudou minha vida..."
              rows={2}
              className="mt-1"
            />
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleAddTestimonial} disabled={addingTestimonial}>
            {addingTestimonial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar Depoimento
          </Button>
        </div>

        {/* Existing testimonials */}
        {testimonials.length > 0 && (
          <div className="space-y-2">
            {testimonials.map((t: any) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{t.author_name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.rating || 5 }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.content}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => handleDeleteTestimonial(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
