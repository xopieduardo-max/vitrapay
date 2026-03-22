import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Plug, Eye, EyeOff } from "lucide-react";

export default function Integrations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [utmifyToken, setUtmifyToken] = useState("");
  const [utmifyActive, setUtmifyActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: integration, isLoading } = useQuery({
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
    if (!user) return;
    if (!utmifyToken.trim()) {
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
    const { error } = await supabase
      .from("user_integrations")
      .delete()
      .eq("id", integration.id);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">Conecte ferramentas externas à sua conta</p>
      </div>

      {/* UTMify */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Plug className="h-4 w-4 text-primary" />
          UTMify
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Rastreamento de vendas</p>
              <p className="text-xs text-muted-foreground">Envio automático de postback com UTMs e dados de venda</p>
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
            <p className="text-[11px] text-muted-foreground">
              Encontre em app.utmify.com.br → Integrações → Credenciais de API
            </p>
          </div>

          <div className="flex items-center gap-2 justify-end">
            {integration && (
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={saving}>
                Remover
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || !utmifyToken.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {integration ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

      {/* Placeholder for future integrations */}
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">Mais integrações em breve (Google Ads, TikTok, etc.)</p>
      </div>
    </div>
  );
}
