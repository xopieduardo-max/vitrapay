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
import { ArrowLeft, Upload, FileText, Image, Loader2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function CreateProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"download" | "lms">("download");
  const [commission, setCommission] = useState([30]);
  const [allowAffiliates, setAllowAffiliates] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductFile(file);
    }
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
      let fileUrl: string | null = null;

      if (coverFile) {
        coverUrl = await uploadFile(coverFile, "covers");
      }
      if (productFile) {
        fileUrl = await uploadFile(productFile, "files");
      }

      const { error } = await supabase.from("products").insert({
        producer_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: priceInCents,
        type,
        affiliate_commission: commission[0],
        allow_affiliates: allowAffiliates,
        is_published: isPublished,
        cover_url: coverUrl,
        file_url: fileUrl,
      });

      if (error) throw error;

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

          {/* Product file */}
          <div className="space-y-2">
            <Label>Arquivo do Produto</Label>
            <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              {productFile ? (
                <div className="flex items-center gap-3 w-full">
                  <FileText className="h-6 w-6 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{productFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(productFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground w-full">
                  <Upload className="h-6 w-6 shrink-0" strokeWidth={1} />
                  <div>
                    <p className="text-sm">Clique para enviar o arquivo</p>
                    <p className="text-xs">PDF, ZIP, MP4, etc. (max 20MB)</p>
                  </div>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                onChange={handleProductFileChange}
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
