import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Image, Upload, FileText, Loader2, X, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  form: Record<string, any>;
  updateField: (field: string, value: any) => void;
}

export default function EditProductSettings({ form, updateField }: Props) {
  const { user } = useAuth();
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Toggles para campos opcionais — por padrão desativados, ativam se já há dados
  const [showDescription, setShowDescription] = useState(!!form.description);
  const [showCover, setShowCover] = useState(!!form.cover_url);
  const [showFile, setShowFile] = useState(!!form.file_url);
  const [showAffiliates, setShowAffiliates] = useState(form.allow_affiliates === true);

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

  const ToggleSection = ({ label, description, enabled, onToggle, children }: {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: (v: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted/20">
        <div className="flex items-center gap-2">
          {enabled ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <div>
            <Label className="text-sm font-medium cursor-pointer" onClick={() => onToggle(!enabled)}>{label}</Label>
            <p className="text-[0.65rem] text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && <div className="p-3 border-t border-border">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Campos obrigatórios — sempre visíveis */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold">Informações básicas</h3>
        <div>
          <Label className="text-xs">Título do produto</Label>
          <Input value={form.title || ""} onChange={(e) => updateField("title", e.target.value)} className="mt-1" />
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

      {/* Campos opcionais com toggle */}
      <ToggleSection
        label="Descrição"
        description="Adicionar uma descrição ao produto"
        enabled={showDescription}
        onToggle={setShowDescription}
      >
        <Textarea value={form.description || ""} onChange={(e) => updateField("description", e.target.value)} rows={4} placeholder="Descreva seu produto..." />
      </ToggleSection>

      <ToggleSection
        label="Imagem de Capa"
        description="Aparece na lista de produtos e no marketplace"
        enabled={showCover}
        onToggle={setShowCover}
      >
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
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
      </ToggleSection>

      <ToggleSection
        label="Arquivo do Produto"
        description="Arquivo entregável (PDF, ZIP, MP4, etc.)"
        enabled={showFile}
        onToggle={setShowFile}
      >
        <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
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
      </ToggleSection>

      <ToggleSection
        label="Programa de Afiliados"
        description="Aparecer nas Oportunidades para afiliados"
        enabled={showAffiliates}
        onToggle={(v) => { setShowAffiliates(v); updateField("allow_affiliates", v); }}
      >
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
      </ToggleSection>

      {/* Publicado — sempre visível */}
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label className="text-sm font-medium">Publicado</Label>
          <p className="text-[0.65rem] text-muted-foreground">Visível para compradores</p>
        </div>
        <Switch checked={form.is_published || false} onCheckedChange={(v) => updateField("is_published", v)} />
      </div>
    </div>
  );
}
