import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Plug, Eye, EyeOff, ChevronDown, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function IntegrationCard({
  title,
  description,
  icon,
  color,
  tutorialSteps,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  color: string;
  tutorialSteps: { step: string; detail: string }[];
  children?: React.ReactNode;
}) {
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold text-white ${color}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {children}

      <Collapsible open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs font-medium text-primary hover:underline w-full">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${tutorialOpen ? "rotate-180" : ""}`} />
            {tutorialOpen ? "Fechar tutorial" : "Ver tutorial de integração"}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Passo a passo</p>
            <ol className="space-y-2.5">
              {tutorialSteps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{s.step}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function UtmifySection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [utmifyToken, setUtmifyToken] = useState("");
  const [utmifyActive, setUtmifyActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: integration } = useQuery({
    queryKey: ["user-integrations", user?.id, "utmify"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("platform", "utmify")
        .maybeSingle();
      if (data && !loaded) {
        setUtmifyToken(data.api_token || "");
        setUtmifyActive(data.is_active);
        setLoaded(true);
      }
      return data;
    },
    enabled: !!user,
  });

  const handleSave = async () => {
    if (!user || !utmifyToken.trim()) {
      toast.error("Informe o token do UTMify.");
      return;
    }
    setSaving(true);
    if (integration) {
      const { error } = await supabase
        .from("user_integrations")
        .update({ api_token: utmifyToken.trim(), is_active: utmifyActive, updated_at: new Date().toISOString() })
        .eq("id", integration.id);
      if (error) toast.error("Erro ao atualizar integração.");
      else toast.success("Integração atualizada!");
    } else {
      const { error } = await supabase
        .from("user_integrations")
        .insert({ user_id: user.id, platform: "utmify", api_token: utmifyToken.trim(), is_active: utmifyActive });
      if (error) toast.error("Erro ao salvar integração.");
      else toast.success("Integração configurada!");
    }
    queryClient.invalidateQueries({ queryKey: ["user-integrations", user?.id, "utmify"] });
    setSaving(false);
  };

  const handleRemove = async () => {
    if (!integration) return;
    setSaving(true);
    const { error } = await supabase.from("user_integrations").delete().eq("id", integration.id);
    if (error) toast.error("Erro ao remover.");
    else {
      toast.success("Integração removida!");
      setUtmifyToken("");
      setUtmifyActive(true);
      setLoaded(false);
    }
    queryClient.invalidateQueries({ queryKey: ["user-integrations", user?.id, "utmify"] });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Ativo</p>
          <p className="text-xs text-muted-foreground">Envio automático de postback com UTMs</p>
        </div>
        <Switch checked={utmifyActive} onCheckedChange={setUtmifyActive} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Token de API</Label>
        <div className="relative">
          <Input
            type={showToken ? "text" : "password"}
            value={utmifyToken}
            onChange={(e) => setUtmifyToken(e.target.value)}
            placeholder="Cole seu token do UTMify aqui"
            className="bg-muted/50 border-transparent focus:border-border pr-10"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        {integration && (
          <Button variant="outline" size="sm" onClick={handleRemove} disabled={saving}>Remover</Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving || !utmifyToken.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {integration ? "Atualizar" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export default function Integrations() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">Conecte ferramentas externas à sua conta para rastrear vendas e campanhas</p>
      </div>

      {/* UTMify */}
      <IntegrationCard
        title="UTMify"
        description="Rastreamento de vendas e campanhas de tráfego pago"
        icon="U"
        color="bg-violet-600"
        tutorialSteps={[
          { step: "Crie sua conta no UTMify", detail: "Acesse app.utmify.com.br e crie sua conta gratuita." },
          { step: "Acesse Integrações → Credenciais de API", detail: "No painel do UTMify, vá em Integrações e copie seu token de API." },
          { step: "Cole o token acima", detail: "Cole o token no campo acima e clique em Salvar." },
          { step: "Pronto!", detail: "Cada venda confirmada será enviada automaticamente ao UTMify com UTMs, afiliado e dados do comprador." },
        ]}
      >
        <UtmifySection />
      </IntegrationCard>

      {/* Facebook Ads */}
      <IntegrationCard
        title="Facebook Ads (Meta Pixel)"
        description="Rastreie conversões e otimize suas campanhas no Facebook e Instagram"
        icon="f"
        color="bg-blue-600"
        tutorialSteps={[
          { step: "Acesse o Gerenciador de Eventos do Facebook", detail: "Vá em business.facebook.com → Gerenciador de Eventos → Fontes de Dados." },
          { step: "Copie o ID do Pixel", detail: "Selecione seu Pixel e copie o ID (número de 15-16 dígitos)." },
          { step: "Adicione o Pixel no seu produto", detail: "Na VitraPay, vá em Meus Produtos → Editar Produto → aba Pixels → Adicione um pixel Facebook com o ID copiado." },
          { step: "Teste com o Meta Pixel Helper", detail: "Instale a extensão Meta Pixel Helper no Chrome e acesse o checkout do produto para verificar os eventos PageView, InitiateCheckout e Purchase." },
        ]}
      >
        <div className="rounded-lg bg-muted/30 p-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">⚙️ Configuração feita por produto em</span>
          <a href="/products" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            Meus Produtos → Editar → Pixels <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </IntegrationCard>

      {/* Google Ads */}
      <IntegrationCard
        title="Google Ads"
        description="Rastreie conversões de vendas nas campanhas do Google Ads"
        icon="G"
        color="bg-green-600"
        tutorialSteps={[
          { step: "Acesse o Google Ads", detail: "Vá em ads.google.com → Ferramentas e Configurações → Medição → Conversões." },
          { step: "Crie uma ação de conversão", detail: "Clique em '+ Nova ação de conversão' → Website → Configure o nome e valor." },
          { step: "Copie o ID de conversão e o rótulo", detail: "Após criar, copie o Conversion ID (ex: AW-123456789) e o Conversion Label." },
          { step: "Adicione no seu produto", detail: "Na VitraPay, vá em Meus Produtos → Editar Produto → aba Pixels → Adicione um pixel Google Ads com o ID copiado." },
          { step: "Teste a conversão", detail: "Faça uma compra teste e verifique no Google Ads se a conversão foi registrada (pode levar até 24h)." },
        ]}
      >
        <div className="rounded-lg bg-muted/30 p-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">⚙️ Configuração feita por produto em</span>
          <a href="/products" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            Meus Produtos → Editar → Pixels <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </IntegrationCard>

      {/* TikTok Ads */}
      <IntegrationCard
        title="TikTok Ads"
        description="Rastreie conversões e otimize campanhas no TikTok"
        icon="T"
        color="bg-black"
        tutorialSteps={[
          { step: "Acesse o TikTok Ads Manager", detail: "Vá em ads.tiktok.com → Assets → Events → Web Events." },
          { step: "Crie um Pixel", detail: "Clique em 'Create Pixel' → Escolha 'Manually Install Pixel Code' → Copie o Pixel ID." },
          { step: "Adicione no seu produto", detail: "Na VitraPay, vá em Meus Produtos → Editar Produto → aba Pixels → Adicione um pixel TikTok com o ID copiado." },
          { step: "Teste o Pixel", detail: "Use o TikTok Pixel Helper (extensão Chrome) para verificar se os eventos estão disparando no checkout." },
        ]}
      >
        <div className="rounded-lg bg-muted/30 p-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">⚙️ Configuração feita por produto em</span>
          <a href="/products" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            Meus Produtos → Editar → Pixels <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </IntegrationCard>
    </div>
  );
}
