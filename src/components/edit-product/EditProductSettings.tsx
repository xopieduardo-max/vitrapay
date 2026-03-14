import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Image, Upload, FileText, Loader2, X } from "lucide-react";

interface Props {
  form: Record<string, any>;
  updateField: (field: string, value: any) => void;
}

export default function EditProductSettings({ form, updateField }: Props) {
  const { user } = useAuth();
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

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

  const handleProductFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const url = await uploadFile(file, "files");
      if (url) {
        updateField("file_url", url);
        updateField("_file_name", file.name);
      }
    } catch {
      // silent
    } finally {
      setUploadingFile(false);
    }
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
                <span className="text-xs">Enviar capa</span>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </label>
        </div>

        {/* Product file */}
        <div>
          <Label className="text-xs">Arquivo do Produto (entregável)</Label>
          <label className="mt-1 flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            {uploadingFile ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : form.file_url ? (
              <div className="flex items-center gap-2 w-full">
                <FileText className="h-5 w-5 text-primary shrink-0" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{form._file_name || "Arquivo enviado"}</p>
                  <p className="text-[0.6rem] text-muted-foreground truncate">{form.file_url}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); updateField("file_url", ""); updateField("_file_name", ""); }}
                  className="shrink-0 rounded-full bg-background/80 p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Upload className="h-5 w-5 shrink-0" strokeWidth={1} />
                <div>
                  <p className="text-xs">Enviar arquivo</p>
                  <p className="text-[0.6rem]">PDF, ZIP, MP4, etc.</p>
                </div>
              </div>
            )}
            <input type="file" className="hidden" onChange={handleProductFileUpload} />
          </label>
        </div>

        {/* Commission */}
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
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm font-medium">Publicado</Label>
            <p className="text-[0.65rem] text-muted-foreground">Visível nas Oportunidades</p>
          </div>
          <Switch checked={form.is_published || false} onCheckedChange={(v) => updateField("is_published", v)} />
        </div>
      </div>
    </div>
  );
}
