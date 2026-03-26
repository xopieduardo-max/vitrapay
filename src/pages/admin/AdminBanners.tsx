import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, Image, GripVertical, Upload, Link2 } from "lucide-react";
import { compressImage } from "@/lib/imageCompressor";

const LOCATION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  marketplace: "Marketplace",
  both: "Ambos",
};

const LOCATION_COLORS: Record<string, string> = {
  dashboard: "bg-primary/10 text-primary",
  marketplace: "bg-emerald-500/10 text-emerald-600",
  both: "bg-amber-500/10 text-amber-600",
};

export default function AdminBanners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newLocation, setNewLocation] = useState("dashboard");
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_banners")
        .select("*")
        .order("position", { ascending: true });
      return data || [];
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const compressed = await compressImage(file, {
      maxWidth: 1920,
      maxHeight: 512,
      quality: 0.82,
    });

    const ext = compressed.name.split(".").pop() || "webp";
    const fileName = `banner_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("checkout-images")
      .upload(`banners/${fileName}`, compressed, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("checkout-images")
      .getPublicUrl(`banners/${fileName}`);

    return urlData.publicUrl;
  };

  const addBanner = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error("Título obrigatório");

      let finalImageUrl = newImageUrl.trim() || null;

      if (imageMode === "upload" && selectedFile) {
        setUploading(true);
        try {
          finalImageUrl = await uploadImage(selectedFile);
        } finally {
          setUploading(false);
        }
      }

      const { error } = await supabase.from("platform_banners").insert({
        title: newTitle.trim(),
        image_url: finalImageUrl,
        link_url: newLink.trim() || null,
        position: banners.length,
        location: newLocation,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Banner criado!" });
      setNewTitle("");
      setNewImageUrl("");
      setNewLink("");
      setNewLocation("dashboard");
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleBanner = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("platform_banners").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-banners"] }),
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Banner removido" });
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    },
  });

  const isPending = addBanner.isPending || uploading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Banners da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie banners do Dashboard e do Marketplace. Eles rodam em carrossel automaticamente.
        </p>
      </div>

      {/* Add new */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Novo Banner</h3>
          <p className="text-[11px] text-muted-foreground">
            Tamanho recomendado: <span className="font-semibold text-foreground">1920 × 512 px</span> (proporção 3.75:1)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Black Friday 🔥" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Exibir em</Label>
            <Select value={newLocation} onValueChange={setNewLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
                <SelectItem value="both">Ambos (Dashboard + Marketplace)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Image mode toggle */}
        <div className="space-y-2">
          <Label className="text-xs">Imagem do Banner</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={imageMode === "upload" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setImageMode("upload")}
            >
              <Upload className="h-3.5 w-3.5" /> Subir imagem
            </Button>
            <Button
              type="button"
              variant={imageMode === "url" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setImageMode("url")}
            >
              <Link2 className="h-3.5 w-3.5" /> Colar link
            </Button>
          </div>

          {imageMode === "upload" ? (
            <div className="space-y-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="text-sm"
              />
              {previewUrl && (
                <div className="relative">
                  <img src={previewUrl} alt="Preview" className="rounded-lg max-h-32 object-cover border border-border" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">A imagem será comprimida automaticamente para WebP (máx 1920px)</p>
            </div>
          ) : (
            <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://..." />
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Link ao clicar (opcional)</Label>
          <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://..." />
        </div>

        <Button size="sm" className="gap-1.5" onClick={() => addBanner.mutate()} disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {isPending ? "Enviando..." : "Adicionar Banner"}
        </Button>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Banners ({banners.length})</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum banner criado.</div>
        ) : (
          banners.map((b: any, i: number) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
              {b.image_url ? (
                <img src={b.image_url} alt="" className="h-10 w-20 rounded object-cover shrink-0 border border-border" />
              ) : (
                <div className="h-10 w-20 rounded bg-muted flex items-center justify-center shrink-0">
                  <Image className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{b.title}</p>
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${LOCATION_COLORS[b.location || "dashboard"] || ""}`}>
                    {LOCATION_LABELS[b.location || "dashboard"] || "Dashboard"}
                  </Badge>
                </div>
                {b.link_url && <p className="text-xs text-muted-foreground truncate">{b.link_url}</p>}
              </div>
              <Switch
                checked={b.is_active}
                onCheckedChange={(v) => toggleBanner.mutate({ id: b.id, is_active: v })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deleteBanner.mutate(b.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
