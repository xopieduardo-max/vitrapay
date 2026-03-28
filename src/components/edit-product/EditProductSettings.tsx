import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Upload, FileText, Loader2, X, Plus } from "lucide-react";

interface Props {
  form: Record<string, any>;
  updateField: (field: string, value: any) => void;
  productId?: string;
  productType?: string;
}

export default function EditProductSettings({ form, updateField, productId, productType }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Fetch existing product files
  const { data: existingFiles = [], isLoading: loadingFiles } = useQuery({
    queryKey: ["product-files", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase
        .from("product_files")
        .select("*")
        .eq("product_id", productId)
        .order("position");
      return data || [];
    },
    enabled: !!productId,
  });

  const uploadFile = async (file: File, folder: string) => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-files").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-files").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadFile(file, "covers");
      if (url) updateField("cover_url", url);
    } catch {
      // silent
    } finally {
      setUploadingCover(false);
    }
  };

  const handleAddProductFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !productId) return;
    setUploadingFiles(true);
    try {
      const maxPosition = existingFiles.length > 0
        ? Math.max(...existingFiles.map((f: any) => f.position ?? 0)) + 1
        : 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadFile(file, "files");
        if (url) {
          await supabase.from("product_files").insert({
            product_id: productId,
            file_url: url,
            file_name: file.name,
            file_size: file.size,
            position: maxPosition + i,
          });
        }
      }

      // Update legacy file_url with first file if empty
      if (!form.file_url && files.length > 0) {
        const firstUrl = await uploadFile(files[0], "files");
        if (firstUrl) updateField("file_url", firstUrl);
      }

      queryClient.invalidateQueries({ queryKey: ["product-files", productId] });
    } catch {
      // silent
    } finally {
      setUploadingFiles(false);
      e.target.value = "";
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    await supabase.from("product_files").delete().eq("id", fileId);
    queryClient.invalidateQueries({ queryKey: ["product-files", productId] });
  };

  return (
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
        {/* Cover image */}
        <div>
          <Label className="text-xs">Imagem de Capa</Label>
          <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            {uploadingCover ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : form.cover_url ? (
              <div className="relative w-full">
                <img src={form.cover_url} alt="Capa" className="h-24 w-full object-cover rounded-md" />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); updateField("cover_url", ""); }}
                  className="absolute top-1 right-1 rounded-full bg-background/80 p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground py-2">
                <Image className="h-6 w-6" strokeWidth={1} />
                <span className="text-xs">Enviar capa ou cole um link abaixo</span>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[0.65rem] text-muted-foreground shrink-0">ou cole a URL:</span>
            <Input
              placeholder="https://exemplo.com/imagem.jpg"
              value={form.cover_url || ""}
              onChange={(e) => updateField("cover_url", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Product files - multiple */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Arquivos do Produto (entregáveis)</Label>
            <span className="text-[0.6rem] text-muted-foreground">
              {loadingFiles ? "..." : `${existingFiles.length} arquivo(s)`}
            </span>
          </div>

          {/* Existing files list */}
          {existingFiles.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {existingFiles.map((f: any) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2.5 bg-muted/20"
                >
                  <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{f.file_name}</p>
                    {f.file_size > 0 && (
                      <p className="text-[0.6rem] text-muted-foreground">
                        {(f.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(f.id)}
                    className="shrink-0 rounded-full p-1 hover:bg-muted transition-colors"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add files button */}
          <label className="mt-1 flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            {uploadingFiles ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                {existingFiles.length === 0 ? (
                  <Upload className="h-5 w-5 shrink-0" strokeWidth={1} />
                ) : (
                  <Plus className="h-5 w-5 shrink-0" strokeWidth={1} />
                )}
                <div>
                  <p className="text-xs">
                    {existingFiles.length === 0 ? "Enviar arquivos" : "Adicionar mais arquivos"}
                  </p>
                  <p className="text-[0.6rem]">PDF, ZIP, MP4, etc.</p>
                </div>
              </div>
            )}
            <input type="file" className="hidden" multiple onChange={handleAddProductFiles} />
          </label>
        </div>

        {/* Affiliate toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm font-medium">Programa de Afiliados</Label>
            <p className="text-[0.65rem] text-muted-foreground">Aparecer nas Oportunidades para afiliados</p>
          </div>
          <Switch checked={form.allow_affiliates ?? true} onCheckedChange={(v) => updateField("allow_affiliates", v)} />
        </div>

        {/* Commission (only if affiliates enabled) */}
        {(form.allow_affiliates ?? true) && (
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
        )}

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm font-medium">Publicado</Label>
            <p className="text-[0.65rem] text-muted-foreground">Visível para compradores</p>
          </div>
          <Switch checked={form.is_published || false} onCheckedChange={(v) => updateField("is_published", v)} />
        </div>
      </div>
    </div>
  );
}
