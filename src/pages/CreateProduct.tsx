import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileText, Image, Loader2, ShieldAlert, X, Plus } from "lucide-react";
import { motion } from "framer-motion";

type PendingFile = { file: File; id: string };

export default function CreateProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: profileVerified, isLoading: checkingVerification } = useQuery({
    queryKey: ["profile-verified", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("profile_verified")
        .eq("user_id", user.id)
        .single();
      return !!(data as any)?.profile_verified;
    },
    enabled: !!user,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"download" | "lms">("download");
  const [commission, setCommission] = useState([30]);
  const [allowAffiliates, setAllowAffiliates] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [productFiles, setProductFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);

  if (checkingVerification) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profileVerified) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold">Verificação necessária</h2>
        <p className="text-sm text-muted-foreground">
          Para criar e vender produtos na VitraPay, você precisa primeiro verificar seus dados pessoais e cadastrar sua chave Pix.
        </p>
        <Button onClick={() => navigate("/settings")} className="gap-2">
          Verificar meus dados
        </Button>
      </div>
    );
  }

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: PendingFile[] = Array.from(files).map((f) => ({
      file: f,
      id: crypto.randomUUID(),
    }));
    setProductFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setProductFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFile = async (file: File, folder: string) => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-files")
      .upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-files").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Erro", description: "Faça login primeiro.", variant: "destructive" });
      return;
    }

    const priceInCents = Math.round(parseFloat(price.replace(",", ".")) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast({ title: "Erro", description: "Informe um preço válido.", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Erro", description: "Informe o título do produto.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let coverUrl: string | null = null;

      if (coverFile) {
        coverUrl = await uploadFile(coverFile, "covers");
      }

      // Use first file as legacy file_url for backward compatibility
      let firstFileUrl: string | null = null;
      if (productFiles.length > 0) {
        firstFileUrl = await uploadFile(productFiles[0].file, "files");
      }

      const { data: newProduct, error } = await supabase.from("products").insert({
        producer_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: priceInCents,
        type,
        affiliate_commission: commission[0],
        allow_affiliates: allowAffiliates,
        is_published: isPublished,
        cover_url: coverUrl,
        file_url: firstFileUrl,
      }).select("id").single();

      if (error) throw error;

      // Upload all files to product_files table
      if (newProduct && productFiles.length > 0) {
        const fileUploads = await Promise.all(
          productFiles.map(async (pf, idx) => {
            const url = idx === 0 && firstFileUrl ? firstFileUrl : await uploadFile(pf.file, "files");
            return {
              product_id: newProduct.id,
              file_url: url!,
              file_name: pf.file.name,
              file_size: pf.file.size,
              position: idx,
            };
          })
        );
        await supabase.from("product_files").insert(fileUploads);
      }

      toast({ title: "Produto criado!", description: "Seu produto foi cadastrado com sucesso." });
      navigate("/products");
    } catch (error: any) {
      toast({ title: "Erro ao criar produto", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-title">Novo Produto</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Preencha os detalhes do seu produto digital
          </p>
        </div>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="space-y-6"
      >
        {/* Basic Info */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-label text-muted-foreground">
            Informações Básicas
          </h2>

          <div className="space-y-2">
            <Label htmlFor="title">Título do Produto</Label>
            <Input
              id="title"
              placeholder="Ex: Curso de React Avançado"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva seu produto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                placeholder="99,90"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "download" | "lms")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="lms">Área de Membros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Files */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-label text-muted-foreground">
            Arquivos
          </h2>

          {/* Cover */}
          <div className="space-y-2">
            <Label>Imagem de Capa</Label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Preview"
                  className="h-32 w-full object-cover rounded-md mb-2"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Image className="h-8 w-8" strokeWidth={1} />
                  <span className="text-sm">Clique para enviar a capa</span>
                  <span className="text-xs">PNG, JPG ou WEBP (max 5MB)</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverChange}
              />
            </label>
          </div>

          {/* Product files - multiple */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Arquivos do Produto</Label>
              <span className="text-xs text-muted-foreground">{productFiles.length} arquivo(s)</span>
            </div>

            {/* File list */}
            {productFiles.length > 0 && (
              <div className="space-y-2">
                {productFiles.map((pf) => (
                  <div
                    key={pf.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/20"
                  >
                    <FileText className="h-5 w-5 text-primary shrink-0" strokeWidth={1.5} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{pf.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(pf.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(pf.id)}
                      className="shrink-0 rounded-full p-1 hover:bg-muted transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add file button */}
            <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 text-muted-foreground w-full">
                {productFiles.length === 0 ? (
                  <Upload className="h-6 w-6 shrink-0" strokeWidth={1} />
                ) : (
                  <Plus className="h-6 w-6 shrink-0" strokeWidth={1} />
                )}
                <div>
                  <p className="text-sm">
                    {productFiles.length === 0
                      ? "Clique para enviar arquivos"
                      : "Adicionar mais arquivos"}
                  </p>
                  <p className="text-xs">PDF, ZIP, MP4, etc. (max 20MB por arquivo)</p>
                </div>
              </div>
              <input
                type="file"
                className="hidden"
                multiple
                onChange={handleAddFiles}
              />
            </label>
          </div>
        </div>

        {/* Affiliate Program */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-label text-muted-foreground">
            Programa de Afiliados
          </h2>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Permitir afiliados</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Produto aparecerá nas Oportunidades para afiliados
              </p>
            </div>
            <Switch checked={allowAffiliates} onCheckedChange={setAllowAffiliates} />
          </div>
          {allowAffiliates && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Comissão para afiliados</Label>
                <span className="text-lg font-bold text-primary">{commission[0]}%</span>
              </div>
              <Slider
                value={commission}
                onValueChange={setCommission}
                max={80}
                min={0}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Defina a porcentagem que cada afiliado receberá por venda indicada.
              </p>
            </div>
          )}
        </div>

        {/* Publish */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Publicar imediatamente</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seu produto ficará visível no marketplace
              </p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/products")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="gap-2 min-w-[140px]">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar Produto"
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
