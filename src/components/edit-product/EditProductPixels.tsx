import { useMemo, useState } from "react";
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
    fields: [{ key: "pixel_id", label: "Pixel ID", placeholder: "1293867678159457" }],
    hasAccessToken: false,
    eventOptions: [
      { key: "fire_on_pix", label: 'Disparar evento "Purchase" ao gerar um pix?', default: true },
      { key: "fire_on_boleto", label: 'Disparar evento "Purchase" ao gerar um boleto?', default: true },
    ],
    conversionOptions: [
      { key: "pix_conversion_value", label: "Valor de conversão personalizado para pix", default: 100 },
      { key: "boleto_conversion_value", label: "Valor de conversão personalizado para boleto", default: 100 },
    ],
    extraOptions: [{ key: "disable_bump_events", label: "Desativar eventos de order bumps?" }],
    maxPixels: 50,
  },
  {
    id: "google_ads",
    label: "Google Ads",
    icon: "▲",
    color: "bg-[#4285F4]",
    fields: [
      { key: "pixel_id", label: "ID do Pixel", placeholder: "AW-123456789" },
      { key: "conversion_label", label: "Label de conversão", placeholder: "AbCdEfGh" },
    ],
    hasAccessToken: false,
    eventOptions: [],
    conversionOptions: [],
    extraOptions: [{ key: "disable_bump_events", label: "Desativar eventos de order bumps?" }],
    maxPixels: 5,
  },
  {
    id: "google_analytics",
    label: "Google Analytics",
    icon: "📊",
    color: "bg-[#E37400]",
    fields: [{ key: "pixel_id", label: "Measurement ID", placeholder: "G-XXXXXXXXXX" }],
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
    fields: [{ key: "pixel_id", label: "Pixel ID", placeholder: "XXXXXXXXXXXXXXXXX" }],
    hasAccessToken: true,
    eventOptions: [
      { key: "fire_on_pix", label: 'Disparar evento "Complete Payment" ao gerar um pix?', default: true },
      { key: "fire_on_boleto", label: 'Disparar evento "Complete Payment" ao gerar um boleto?', default: true },
    ],
    conversionOptions: [
      { key: "pix_conversion_value", label: "Valor de conversão personalizado para pix", default: 100 },
      { key: "boleto_conversion_value", label: "Valor de conversão personalizado para boleto", default: 100 },
    ],
    extraOptions: [{ key: "disable_bump_events", label: "Desativar eventos de order bumps?" }],
    maxPixels: 50,
  },
] as const;

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
          conversion_label: "",
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-pixels", productId] });
      toast({ title: "Pixel adicionado" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao adicionar pixel", description: error.message, variant: "destructive" });
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
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar pixel", description: error.message, variant: "destructive" });
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
    onError: (error: any) => {
      toast({ title: "Erro ao remover pixel", description: error.message, variant: "destructive" });
    },
  });

  const platform = PLATFORMS.find((item) => item.id === activeTab)!;
  const platformPixels = pixels.filter((pixel: any) => pixel.platform === activeTab);

  const gridTemplateColumns = useMemo(() => {
    const columns = [...platform.fields.map(() => "minmax(0,1fr)")];

    if (platform.hasAccessToken) {
      columns.push("minmax(0,1fr)");
    }

    columns.push("40px", "40px");
    return columns.join(" ");
  }, [platform]);

  const getFieldValue = (pixel: any, key: string) => {
    if (key === "pixel_id") return pixel.pixel_id || "";
    if (key === "access_token") return pixel.access_token || "";
    return pixel.config?.[key] ?? "";
  };

  const buildFieldUpdate = (pixel: any, key: string, value: string) => {
    if (key === "pixel_id" || key === "access_token") {
      return { [key]: value };
    }

    return {
      config: {
        ...(pixel.config as Record<string, any>),
        [key]: value,
      },
    };
  };

  const savePixels = async () => {
    toast({ title: "Pixels salvos!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 overflow-x-auto">
        {PLATFORMS.map((item) => {
          const count = pixels.filter((pixel: any) => pixel.platform === item.id).length;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === item.id
                  ? "bg-card border border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[0.6rem] text-white font-bold ${item.color}`}>
                {item.icon}
              </span>
              {item.label}
              {count > 0 && (
                <Badge variant="secondary" className="text-[0.55rem] h-4 px-1.5">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className="grid gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-widest text-muted-foreground"
          style={{ gridTemplateColumns }}
        >
          {platform.fields.map((field) => (
            <span key={field.key}>{field.label}</span>
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
          platformPixels.map((pixel: any) => (
            <div
              key={pixel.id}
              className="grid gap-4 px-4 py-3 border-b border-border last:border-0 items-center"
              style={{ gridTemplateColumns }}
            >
              {platform.fields.map((field) => (
                <Input
                  key={field.key}
                  value={getFieldValue(pixel, field.key)}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    updatePixel.mutate({
                      id: pixel.id,
                      updates: buildFieldUpdate(pixel, field.key, event.target.value),
                    })
                  }
                  className="h-9 bg-muted/30 border-transparent text-sm font-mono"
                />
              ))}

              {platform.hasAccessToken && (
                <Input
                  value={getFieldValue(pixel, "access_token")}
                  placeholder="Access Token"
                  onChange={(event) =>
                    updatePixel.mutate({
                      id: pixel.id,
                      updates: buildFieldUpdate(pixel, "access_token", event.target.value),
                    })
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
                onClick={() => deletePixel.mutate(pixel.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}

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

      {(platform.eventOptions.length > 0 || platform.extraOptions.length > 0) && platformPixels.length > 0 && (
        <div className="space-y-4">
          {platform.eventOptions.map((option) => (
            <div key={option.key} className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={platformPixels[0]?.config?.[option.key] ?? option.default}
                  onCheckedChange={(value) =>
                    updatePixel.mutate({
                      id: platformPixels[0].id,
                      updates: {
                        config: {
                          ...(platformPixels[0].config as Record<string, any>),
                          [option.key]: value,
                        },
                      },
                    })
                  }
                />
                <Label className="text-sm">{option.label}</Label>
              </div>

              {platform.conversionOptions
                .filter((conversion) => conversion.key.includes(option.key.replace("fire_on_", "")))
                .map((conversion) => (
                  <div key={conversion.key} className="ml-12 space-y-1">
                    <Label className="text-xs text-primary">{conversion.label}</Label>
                    <div className="flex items-center gap-2 w-32">
                      <Input
                        type="number"
                        value={platformPixels[0]?.config?.[conversion.key] ?? conversion.default}
                        onChange={(event) =>
                          updatePixel.mutate({
                            id: platformPixels[0].id,
                            updates: {
                              config: {
                                ...(platformPixels[0].config as Record<string, any>),
                                [conversion.key]: Number(event.target.value),
                              },
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

          {platform.extraOptions.map((option) => (
            <div key={option.key} className="flex items-center gap-3">
              <Switch
                checked={platformPixels[0]?.config?.[option.key] ?? false}
                onCheckedChange={(value) =>
                  updatePixel.mutate({
                    id: platformPixels[0].id,
                    updates: {
                      config: {
                        ...(platformPixels[0].config as Record<string, any>),
                        [option.key]: value,
                      },
                    },
                  })
                }
              />
              <Label className="text-sm">{option.label}</Label>
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
