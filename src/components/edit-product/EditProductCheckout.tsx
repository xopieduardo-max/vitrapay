import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Star, Loader2, Copy, Check, ExternalLink, MessageSquareQuote, Paintbrush, Sun, Moon, Bell, Palette, ClipboardList } from "lucide-react";

const COLOR_THEMES = [
  { id: "classic", label: "Clássico", color: "hsl(0, 0%, 15%)" },
  { id: "cyan", label: "Ciano", color: "hsl(180, 70%, 50%)" },
  { id: "emerald", label: "Esmeralda", color: "hsl(142, 71%, 45%)" },
  { id: "ocean", label: "Ocean", color: "hsl(210, 100%, 50%)" },
  { id: "violet", label: "Violeta", color: "hsl(262, 83%, 58%)" },
  { id: "floral", label: "Floral", color: "hsl(330, 80%, 55%)" },
  { id: "coral", label: "Coral", color: "hsl(0, 84%, 55%)" },
  { id: "amber", label: "Âmbar", color: "hsl(25, 95%, 53%)" },
  { id: "solar", label: "Solar", color: "hsl(45, 93%, 47%)" },
];

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

      {/* Tema do Checkout (Claro/Escuro) */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold">Plano de Fundo</h3>
        <p className="text-xs text-muted-foreground">Escolha se o checkout será exibido no modo claro ou escuro.</p>
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
            Claro
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
            Escuro
          </button>
        </div>
      </div>

      {/* Color Theme Selector */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Palette className="h-4 w-4" /> Tema de Cores
        </h3>
        <p className="text-xs text-muted-foreground">Escolha a cor de destaque do checkout (botões, badges, detalhes).</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {COLOR_THEMES.map((theme) => {
            const isSelected = (form.checkout_color_theme || "classic") === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => updateField("checkout_color_theme", theme.id)}
                className="flex flex-col items-center gap-1.5 rounded-lg p-3 transition-all"
                style={{
                  border: isSelected ? `2px solid ${theme.color}` : "2px solid hsl(var(--border))",
                  background: isSelected ? `${theme.color}10` : "transparent",
                }}
              >
                <div
                  className="h-8 w-full rounded-md"
                  style={{ background: theme.color }}
                />
                <span className="text-[0.65rem] font-medium">{theme.label}</span>
              </button>
            );
          })}
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
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-xs">Imagens do checkout</Label>
                  <p className="text-[0.65rem] text-muted-foreground mt-1">
                    A imagem horizontal e a imagem vertical agora ficam dentro de <strong>Editar Checkout</strong>, com as dimensões corretas e preview visual.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={() => navigate(`/products/${productId}/checkout-builder`)}
                >
                  <Paintbrush className="h-3.5 w-3.5" /> Abrir editor
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gatilhos - Social Proof */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Bell className="h-4 w-4" /> Notificações de Vendas
          </h3>
          <Switch
            checked={form.checkout_social_proof || false}
            onCheckedChange={(checked) => updateField("checkout_social_proof", checked)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Exibe notificações de vendas fictícias no checkout para criar prova social e urgência.
        </p>

        {form.checkout_social_proof && (
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Intervalo entre as notificações</Label>
              <div className="flex gap-2 mt-2">
                {[15, 30, 45, 60].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => updateField("checkout_social_proof_interval", sec)}
                    className="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all"
                    style={{
                      background: (form.checkout_social_proof_interval || 30) === sec ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: (form.checkout_social_proof_interval || 30) === sec ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                      border: (form.checkout_social_proof_interval || 30) === sec ? "1px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
                    }}
                  >
                    {sec < 60 ? `${sec} seg` : "1 min"}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Mensagens que serão exibidas:</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• "XX pessoas estão comprando o {`{produto}`} agora."</li>
                <li>• "XX pessoas compraram o {`{produto}`} agora mesmo."</li>
                <li>• "Maria de São Paulo acabou de comprar o {`{produto}`}!"</li>
                <li>• "XX pessoas compraram nos últimos 30 minutos."</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Dados solicitados no checkout */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" /> Dados solicitados no checkout
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha quais dados serão pedidos ao cliente. O e-mail é sempre obrigatório. Para pagamento com cartão, nome e CPF são sempre exigidos.
          </p>
        </div>
        {(["name", "cpf", "phone"] as const).map((field) => {
          const labels: Record<string, { label: string; desc: string }> = {
            name:  { label: "Nome",      desc: "Solicitar nome completo" },
            cpf:   { label: "CPF/CNPJ", desc: "Solicitar número do CPF ou CNPJ" },
            phone: { label: "Telefone",  desc: "Solicitar número de telefone" },
          };
          const fields = (form.checkout_fields as Record<string, boolean>) || { name: true, cpf: true, phone: true };
          const isOn = fields[field] !== false;
          return (
            <div key={field} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-semibold">{labels[field].label}</p>
                <p className="text-xs text-muted-foreground">{labels[field].desc}</p>
              </div>
              <Switch
                checked={isOn}
                onCheckedChange={(checked) =>
                  updateField("checkout_fields", { ...fields, [field]: checked })
                }
              />
            </div>
          );
        })}
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
