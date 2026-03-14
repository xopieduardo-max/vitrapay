import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Settings } from "lucide-react";

const PLATFORMS = [
  {
    id: "facebook",
    label: "Facebook",
    icon: "f",
    color: "bg-[#1877F2]",
    fields: [
      { key: "pixel_id", label: "Pixel Id", placeholder: "1293867678159457" },
    ],
    hasAccessToken: false,
    eventOptions: [
      { key: "fire_on_pix", label: 'Disparar evento "Purchase" ao gerar um pix?', default: true },
      { key: "fire_on_boleto", label: 'Disparar evento "Purchase" ao gerar um boleto?', default: true },
    ],
    conversionOptions: [
      { key: "pix_conversion_value", label: "Valor de conversão personalizado para pix", default: 100 },
      { key: "boleto_conversion_value", label: "Valor de conversão personalizado para boleto", default: 100 },
    ],
    extraOptions: [
      { key: "disable_bump_events", label: "Desativar eventos de order bumps?" },
    ],
    maxPixels: 50,
  },
  {
    id: "google_ads",
    label: "Google Ads",
    icon: "▲",
    color: "bg-[#4285F4]",
    fields: [
      { key: "pixel_id", label: "Nome", placeholder: "AW-123456789" },
      { key: "conversion_label", label: "ID do Pixel", placeholder: "AbCdEfGh" },
    ],
    hasAccessToken: false,
    eventOptions: [],
    conversionOptions: [],
    extraOptions: [
      { key: "disable_bump_events", label: "Desativar eventos de order bumps?" },
    ],
    maxPixels: 5,
  },
  {
    id: "google_analytics",
    label: "Google Analytics",
    icon: "📊",
    color: "bg-[#E37400]",
    fields: [
      { key: "pixel_id", label: "Measurement ID", placeholder: "G-XXXXXXXXXX" },
    ],
    hasAccessToken: false,
    eventOptions: [],
    conversionOptions: [],
    extraOptions: [],
    maxPixels: 5,
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: "♪",
    color: "bg-[#010101]",
    fields: [
      { key: "pixel_id", label: "Pixel Id", placeholder: "XXXXXXXXXXXXXXXXX" },
    ],
    hasAccessToken: true,
    eventOptions: [
      { key: "fire_on_pix", label: 'Disparar evento "Complete Payment" ao gerar um pix?', default: true },
      { key: "fire_on_boleto", label: 'Disparar evento "Complete Payment" ao gerar um boleto?', default: true },
    ],
    conversionOptions: [
      { key: "pix_conversion_value", label: "Valor de conversão personalizado para pix", default: 100 },
      { key: "boleto_conversion_value", label: "Valor de conversão personalizado para boleto", default: 100 },
    ],
    extraOptions: [
      { key: "disable_bump_events", label: "Desativar eventos de order bumps?" },
    ],
    maxPixels: 50,
  },
];

interface Props {
  productId: string;
}

export default function EditProductPixels({ productId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("facebook");

  const { data: pixels = [], isLoading } = useQuery({
    queryKey: ["product-pixels", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_pixels")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const addPixel = useMutation({
    mutationFn: async (platform: string) => {
      const { error } = await supabase.from("product_pixels").insert({
        product_id: productId,
        platform,
        pixel_id: "",
        config: {
          fire_on_pix: true,
          fire_on_boleto: true,
          pix_conversion_value: 100,
          boleto_conversion_value: 100,
          disable_bump_events: false,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-pixels", productId] });
    },
  });

  const updatePixel = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("product_pixels")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-pixels", productId] });
    },
  });

  const deletePixel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_pixels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-pixels", productId] });
      toast({ title: "Pixel removido" });
    },
  });

  const savePixels = async () => {
    toast({ title: "Pixels salvos!" });
  };

  const platform = PLATFORMS.find((p) => p.id === activeTab)!;
  const platformPixels = pixels.filter((p: any) => p.platform === activeTab);

  return (
    <div className="space-y-6">
      {/* Platform Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {PLATFORMS.map((p) => {
          const count = pixels.filter((px: any) => px.platform === p.id).length;
          return (
            <button
              key={p.id}
              onClick={() => setActiveTab(p.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === p.id
                  ? "bg-card border border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[0.6rem] text-white font-bold ${p.color}`}>
                {p.icon}
              </span>
              {p.label}
              {count > 0 && (
                <Badge variant="secondary" className="text-[0.55rem] h-4 px-1.5">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Pixel List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="grid gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-widest text-muted-foreground"
          style={{ gridTemplateColumns: platform.hasAccessToken ? "1fr 1fr 40px 40px" : "1fr 40px 40px" }}
        >
          {platform.fields.map((f) => (
            <span key={f.key}>{f.label}</span>
          ))}
          {platform.hasAccessToken && <span>API Access Token</span>}
          <span></span>
          <span></span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : platformPixels.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nenhum pixel adicionado
          </div>
        ) : (
          platformPixels.map((px: any) => (
            <div
              key={px.id}
              className="grid gap-4 px-4 py-3 border-b border-border last:border-0 items-center"
              style={{ gridTemplateColumns: platform.hasAccessToken ? "1fr 1fr 40px 40px" : "1fr 40px 40px" }}
            >
              <Input
                value={px.pixel_id}
                placeholder={platform.fields[0]?.placeholder}
                onChange={(e) =>
                  updatePixel.mutate({ id: px.id, updates: { pixel_id: e.target.value } })
                }
                className="h-9 bg-muted/30 border-transparent text-sm font-mono"
              />
              {platform.hasAccessToken && (
                <Input
                  value={px.access_token || ""}
                  placeholder="Access Token"
                  onChange={(e) =>
                    updatePixel.mutate({ id: px.id, updates: { access_token: e.target.value } })
                  }
                  className="h-9 bg-muted/30 border-transparent text-sm font-mono"
                />
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deletePixel.mutate(px.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}

        {/* Add Button */}
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={platformPixels.length >= platform.maxPixels || addPixel.isPending}
            onClick={() => addPixel.mutate(activeTab)}
          >
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
          <span className="text-xs text-muted-foreground">
            {platformPixels.length} / {platform.maxPixels}
          </span>
        </div>
      </div>

      {/* Event Options */}
      {(platform.eventOptions.length > 0 || platform.extraOptions.length > 0) && platformPixels.length > 0 && (
        <div className="space-y-4">
          {platform.eventOptions.map((opt) => (
            <div key={opt.key} className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={platformPixels[0]?.config?.[opt.key] ?? opt.default}
                  onCheckedChange={(v) =>
                    updatePixel.mutate({
                      id: platformPixels[0].id,
                      updates: { config: { ...(platformPixels[0].config as Record<string, any>), [opt.key]: v } },
                    })
                  }
                />
                <Label className="text-sm">{opt.label}</Label>
              </div>
              {/* Conversion value input for matching conversion option */}
              {platform.conversionOptions
                .filter((c) => c.key.includes(opt.key.replace("fire_on_", "")))
                .map((conv) => (
                  <div key={conv.key} className="ml-12 space-y-1">
                    <Label className="text-xs text-primary">{conv.label}</Label>
                    <div className="flex items-center gap-2 w-32">
                      <Input
                        type="number"
                        value={platformPixels[0]?.config?.[conv.key] ?? conv.default}
                        onChange={(e) =>
                          updatePixel.mutate({
                            id: platformPixels[0].id,
                            updates: {
                              config: { ...platformPixels[0].config, [conv.key]: Number(e.target.value) },
                            },
                          })
                        }
                        className="h-8 w-20 bg-muted/30 border-transparent text-sm"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
            </div>
          ))}

          {platform.extraOptions.map((opt) => (
            <div key={opt.key} className="flex items-center gap-3">
              <Switch
                checked={platformPixels[0]?.config?.[opt.key] ?? false}
                onCheckedChange={(v) =>
                  updatePixel.mutate({
                    id: platformPixels[0].id,
                    updates: { config: { ...platformPixels[0].config, [opt.key]: v } },
                  })
                }
              />
              <Label className="text-sm">{opt.label}</Label>
            </div>
          ))}

          <div className="flex justify-end">
            <Button size="sm" onClick={savePixels}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
