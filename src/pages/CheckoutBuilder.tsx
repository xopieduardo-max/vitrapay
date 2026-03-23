import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  ArrowLeft, Save, Loader2, Eye, Plus, Trash2, GripVertical,
  Type, Image, ListChecks, Award, Clock, Star, Video, MessageSquareQuote,
  ChevronUp, ChevronDown, Settings2, Palette, MonitorSmartphone, Smartphone, Upload,
} from "lucide-react";

const BLOCK_TYPES = [
  { type: "text", label: "Texto", icon: Type, description: "Bloco de texto livre" },
  { type: "image", label: "Imagem", icon: Image, description: "Banner ou imagem" },
  { type: "benefits", label: "Vantagens", icon: ListChecks, description: "Lista de benefícios" },
  { type: "badge", label: "Selo", icon: Award, description: "Selo de confiança" },
  { type: "timer", label: "Cronômetro", icon: Clock, description: "Timer de urgência" },
  { type: "testimonial", label: "Depoimento", icon: Star, description: "Prova social" },
  { type: "video", label: "Vídeo", icon: Video, description: "Vídeo embed" },
  { type: "headline", label: "Header", icon: Type, description: "Título grande" },
] as const;

type BlockType = typeof BLOCK_TYPES[number]["type"];

interface Block {
  id: string;
  block_type: BlockType;
  position: number;
  config: Record<string, any>;
  is_active: boolean;
}

const defaultConfig: Record<BlockType, Record<string, any>> = {
  text: { content: "", align: "left", size: "base" },
  image: { url: "", alt: "", fullWidth: true },
  benefits: { items: ["Benefício 1", "Benefício 2", "Benefício 3"], icon: "check" },
  badge: { text: "Garantia de 7 dias", icon: "shield", style: "green" },
  timer: { minutes: 15, text: "Oferta expira em:" },
  testimonial: { author: "", content: "", rating: 5, avatar_url: "" },
  video: { url: "", type: "youtube" },
  headline: { text: "Título Principal", size: "2xl", align: "center", bold: true },
};

export default function CheckoutBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [checkoutMedia, setCheckoutMedia] = useState({
    checkout_banner_url: "",
    checkout_sidebar_banner_url: "",
  });

  const { data: product } = useQuery({
    queryKey: ["builder-product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: savedBlocks, isLoading } = useQuery({
    queryKey: ["checkout-blocks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkout_blocks")
        .select("*")
        .eq("product_id", id!)
        .order("position", { ascending: true });
      return (data || []) as Block[];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (savedBlocks && !hasChanges) {
      setBlocks(savedBlocks);
    }
  }, [savedBlocks]);

  useEffect(() => {
    if (product) {
      setCheckoutMedia({
        checkout_banner_url: product.checkout_banner_url || "",
        checkout_sidebar_banner_url: product.checkout_sidebar_banner_url || "",
      });
    }
  }, [product]);

  const updateCheckoutMedia = (field: "checkout_banner_url" | "checkout_sidebar_banner_url", value: string) => {
    setCheckoutMedia((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addBlock = (type: BlockType) => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      block_type: type,
      position: blocks.length,
      config: { ...defaultConfig[type] },
      is_active: true,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    setHasChanges(true);
  };

  const removeBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
    setHasChanges(true);
  };

  const updateBlockConfig = (blockId: string, key: string, value: any) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, config: { ...b.config, [key]: value } } : b))
    );
    setHasChanges(true);
  };

  const toggleBlockActive = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, is_active: !b.is_active } : b))
    );
    setHasChanges(true);
  };

  const moveBlock = (blockId: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= prev.length - 1)) return prev;
      const newArr = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
      return newArr.map((b, i) => ({ ...b, position: i }));
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error: productError } = await supabase
        .from("products")
        .update({
          checkout_banner_url: checkoutMedia.checkout_banner_url || null,
          checkout_sidebar_banner_url: checkoutMedia.checkout_sidebar_banner_url || null,
        })
        .eq("id", id);

      if (productError) throw productError;

      // Delete old blocks
      await supabase.from("checkout_blocks").delete().eq("product_id", id);
      // Insert new
      if (blocks.length > 0) {
        const inserts = blocks.map((b, i) => ({
          product_id: id,
          block_type: b.block_type,
          position: i,
          config: b.config,
          is_active: b.is_active,
        }));
        const { error } = await supabase.from("checkout_blocks").insert(inserts);
        if (error) throw error;
      }
      toast({ title: "Checkout salvo!" });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["builder-product", id] });
      queryClient.invalidateQueries({ queryKey: ["checkout-blocks", id] });
      queryClient.invalidateQueries({ queryKey: ["edit-product", id] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
  const checkoutUrl = `${window.location.origin}/checkout/${id}`;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/products/${id}/edit`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold truncate max-w-[200px]">{product?.title || "Checkout"}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button
              onClick={() => setPreviewMode("desktop")}
              className={`p-1.5 rounded-md transition-colors ${previewMode === "desktop" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <MonitorSmartphone className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewMode("mobile")}
              className={`p-1.5 rounded-md transition-colors ${previewMode === "mobile" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          {hasChanges && (
            <span className="text-xs text-warning font-medium">● Alterações não salvas</span>
          )}

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(checkoutUrl, "_blank")}>
            <Eye className="h-3.5 w-3.5" /> Pré-visualizar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar checkout
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 p-6">
          <div
            className={`mx-auto transition-all duration-300 ${previewMode === "mobile" ? "max-w-[375px]" : "max-w-[900px]"}`}
          >
            {/* ── Realistic Checkout Preview ── */}
            <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "hsl(240, 10%, 6%)", color: "hsl(0,0%,90%)" }}>

              {checkoutMedia.checkout_banner_url && (
                <div className="p-4 pb-0">
                  <div className="aspect-[21/9] overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <img
                      src={checkoutMedia.checkout_banner_url}
                      alt="Banner horizontal do checkout"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Custom blocks drop zone (above form) */}
              <div
                className="relative min-h-[60px]"
                onClick={() => setSelectedBlockId(null)}
              >
                {blocks.length === 0 && (
                  <div className="border-2 border-dashed border-border/30 m-4 py-12 flex flex-col items-center justify-center gap-2 rounded-xl" style={{ color: "hsl(240,5%,45%)" }}>
                    <Plus className="h-6 w-6" />
                    <p className="text-xs">Arraste componentes aqui</p>
                  </div>
                )}

                {/* Block list */}
                <div className="space-y-0">
                  {blocks.map((block, idx) => {
                    const typeDef = BLOCK_TYPES.find((t) => t.type === block.block_type);
                    const Icon = typeDef?.icon || Type;
                    const isSelected = selectedBlockId === block.id;

                    return (
                      <motion.div
                        key={block.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: block.is_active ? 1 : 0.4, y: 0 }}
                        className={`relative group cursor-pointer transition-all ${
                          isSelected ? "ring-2 ring-primary ring-inset" : "hover:ring-1 hover:ring-primary/40 hover:ring-inset"
                        }`}
                        onClick={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); }}
                      >
                        {/* Hover toolbar */}
                        <div className={`absolute top-1 right-1 z-10 flex items-center gap-0.5 rounded-md px-1 py-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`} style={{ background: "hsl(240,10%,15%)" }}>
                          <span className="text-[0.6rem] font-medium px-1" style={{ color: "hsl(240,5%,50%)" }}>{typeDef?.label}</span>
                          <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up"); }} className="p-0.5 hover:bg-white/10 rounded" disabled={idx === 0}>
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down"); }} className="p-0.5 hover:bg-white/10 rounded" disabled={idx === blocks.length - 1}>
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toggleBlockActive(block.id); }} className="p-0.5 hover:bg-white/10 rounded">
                            <Eye className={`h-3 w-3 ${block.is_active ? "text-primary" : ""}`} style={{ color: block.is_active ? undefined : "hsl(240,5%,40%)" }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="p-0.5 hover:bg-red-500/20 rounded" style={{ color: "hsl(0,84%,60%)" }}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Block content */}
                        <div className="px-4 py-3">
                          <BlockPreview block={block} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* ── Product Info (static preview) ── */}
              <div className="px-5 py-4" style={{ borderTop: "1px solid hsl(240,5%,12%)" }}>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="space-y-1.5">
                    <p className="text-lg font-bold">{product?.title || "Nome do produto"}</p>
                    <p className="text-sm font-semibold text-emerald-400">
                      R$ {product ? (product.price / 100).toFixed(2) : "0,00"} à vista
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Form skeleton ── */}
              <div className={`px-5 py-4 ${previewMode === "mobile" ? "" : "grid grid-cols-5 gap-5"}`}>
                <div className={`space-y-3 ${previewMode === "mobile" ? "" : "col-span-3"}`}>
                  {/* Contact fields */}
                  <div className="space-y-2.5">
                    <div className="h-3 w-32 rounded" style={{ background: "hsl(240,10%,14%)" }} />
                    <div className="h-10 w-full rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                    <div className="h-10 w-full rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                    <div className="h-10 w-full rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="h-10 rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                      <div className="h-10 rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                    </div>
                  </div>
                  {/* Payment */}
                  <div className="space-y-2.5 pt-2">
                    <div className="h-3 w-40 rounded" style={{ background: "hsl(240,10%,14%)" }} />
                    <div className="flex gap-2">
                      <div className="h-10 flex-1 rounded-lg" style={{ background: "hsl(48,96%,53%,0.15)", border: "1px solid hsl(48,96%,53%,0.4)" }} />
                      <div className="h-10 flex-1 rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                    </div>
                    <div className="h-10 w-full rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="h-10 rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                      <div className="h-10 rounded-lg" style={{ background: "hsl(240,10%,10%)", border: "1px solid hsl(240,5%,15%)" }} />
                    </div>
                  </div>
                  {/* Buy button */}
                  <div className="h-12 w-full rounded-xl" style={{ background: "hsl(48, 96%, 53%)" }} />
                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-2 py-2">
                    <div className="h-3 w-48 rounded" style={{ background: "hsl(240,10%,12%)" }} />
                  </div>
                </div>

                {/* Right column - testimonials preview (desktop only) */}
                {previewMode === "desktop" && (
                  <div className="col-span-2 space-y-3">
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
                      <div className="bg-emerald-500 px-4 py-3 text-center text-sm font-bold text-white">
                        Compra segura
                      </div>
                      <div className="space-y-3 p-4">
                        <div>
                          <p className="text-base font-bold">{product?.title || "Nome do produto"}</p>
                          <p className="text-xs text-white/60">Precisa de ajuda? Veja o contato do vendedor</p>
                        </div>
                        <div className="border-t border-dashed border-white/10 pt-3">
                          <p className="text-sm font-semibold">Total</p>
                          <p className="text-lg font-black text-emerald-400">
                            R$ {product ? (product.price / 100).toFixed(2) : "0,00"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
                      {checkoutMedia.checkout_sidebar_banner_url ? (
                        <div className="aspect-[3/4]">
                          <img
                            src={checkoutMedia.checkout_sidebar_banner_url}
                            alt="Banner vertical do checkout"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[3/4] items-center justify-center px-6 text-center text-xs text-white/45">
                          Imagem vertical do checkout · 3:4 · ex.: 900×1200
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {previewMode === "mobile" && checkoutMedia.checkout_sidebar_banner_url && (
                <div className="px-5 pb-5">
                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <img
                      src={checkoutMedia.checkout_sidebar_banner_url}
                      alt="Banner vertical do checkout"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-[320px] border-l border-border bg-card shrink-0 overflow-y-auto hidden md:flex flex-col">
          {selectedBlock ? (
            <BlockConfigurator
              block={selectedBlock}
              onUpdate={(key, val) => updateBlockConfig(selectedBlock.id, key, val)}
              onClose={() => setSelectedBlockId(null)}
            />
          ) : (
            <BuilderSidebar media={checkoutMedia} onMediaChange={updateCheckoutMedia} onAdd={addBlock} />
          )}
        </div>
      </div>
    </div>
  );
}

function BuilderSidebar({
  media,
  onMediaChange,
  onAdd,
}: {
  media: { checkout_banner_url: string; checkout_sidebar_banner_url: string };
  onMediaChange: (field: "checkout_banner_url" | "checkout_sidebar_banner_url", value: string) => void;
  onAdd: (type: BlockType) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="p-4 space-y-4 border-b border-border">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Imagens do checkout</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Aqui você define a imagem horizontal e a imagem vertical do checkout. Isso não usa a capa do produto.
          </p>
        </div>

        <ImageUploadField
          label="Imagem horizontal"
          description="Banner principal do checkout · proporção 21:9 · exemplo 1200×514"
          value={media.checkout_banner_url}
          onUpdate={(url) => onMediaChange("checkout_banner_url", url)}
          placeholder="Cole a URL do banner horizontal"
        />

        <ImageUploadField
          label="Imagem vertical"
          description="Banner lateral do checkout · proporção 3:4 · exemplo 900×1200"
          value={media.checkout_sidebar_banner_url}
          onUpdate={(url) => onMediaChange("checkout_sidebar_banner_url", url)}
          placeholder="Cole a URL do banner vertical"
        />
      </div>

      <ComponentPalette onAdd={onAdd} />
    </div>
  );
}

/* ─── Component Palette ─── */
function ComponentPalette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Componentes</h3>
      <div className="grid grid-cols-2 gap-2">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            onClick={() => onAdd(bt.type)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <bt.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-medium">{bt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Image Upload Helper ─── */
function ImageUploadField({
  label,
  description,
  value,
  onUpdate,
  placeholder,
}: {
  label: string;
  description?: string;
  value: string;
  onUpdate: (url: string) => void;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Apenas imagens são permitidas", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagem muito grande (máx 10MB)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("checkout-images").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("checkout-images").getPublicUrl(path);
      onUpdate(publicUrl);
      toast({ title: "Imagem enviada!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">{label}</Label>
        {description && <p className="mt-1 text-[0.65rem] text-muted-foreground">{description}</p>}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={value || ""}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder={placeholder || "https://..."}
          className="flex-1"
        />
        <label className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 h-10 text-xs font-medium cursor-pointer hover:bg-muted transition-colors shrink-0">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>
      {value && (
        <div className="rounded-lg overflow-hidden border border-border">
          <img src={value} alt="Preview" className="w-full h-auto max-h-40 object-cover" />
        </div>
      )}
    </div>
  );
}

/* ─── Block Configurator ─── */
function BlockConfigurator({
  block,
  onUpdate,
  onClose,
}: {
  block: Block;
  onUpdate: (key: string, value: any) => void;
  onClose: () => void;
}) {
  const typeDef = BLOCK_TYPES.find((t) => t.type === block.block_type);
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">{typeDef?.label}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>

      {block.block_type === "text" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Conteúdo</Label>
            <Textarea
              value={block.config.content || ""}
              onChange={(e) => onUpdate("content", e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <div className="flex gap-1 mt-1">
              {["left", "center", "right"].map((a) => (
                <button
                  key={a}
                  onClick={() => onUpdate("align", a)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    block.config.align === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a === "left" ? "Esquerda" : a === "center" ? "Centro" : "Direita"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Tamanho</Label>
            <div className="flex gap-1 mt-1">
              {[{ v: "sm", l: "P" }, { v: "base", l: "M" }, { v: "lg", l: "G" }].map((s) => (
                <button
                  key={s.v}
                  onClick={() => onUpdate("size", s.v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    block.config.size === s.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {block.block_type === "headline" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto</Label>
            <Input
              value={block.config.text || ""}
              onChange={(e) => onUpdate("text", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Tamanho</Label>
            <div className="flex gap-1 mt-1">
              {[{ v: "xl", l: "P" }, { v: "2xl", l: "M" }, { v: "3xl", l: "G" }, { v: "4xl", l: "XG" }].map((s) => (
                <button
                  key={s.v}
                  onClick={() => onUpdate("size", s.v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    block.config.size === s.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <div className="flex gap-1 mt-1">
              {["left", "center", "right"].map((a) => (
                <button
                  key={a}
                  onClick={() => onUpdate("align", a)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    block.config.align === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a === "left" ? "Esquerda" : a === "center" ? "Centro" : "Direita"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Negrito</Label>
            <Switch checked={block.config.bold ?? true} onCheckedChange={(v) => onUpdate("bold", v)} />
          </div>
        </div>
      )}

      {block.block_type === "image" && (
        <div className="space-y-3">
          <ImageUploadField
            label="Imagem"
            value={block.config.url || ""}
            onUpdate={(url) => onUpdate("url", url)}
          />
          <div>
            <Label className="text-xs">Texto alternativo</Label>
            <Input
              value={block.config.alt || ""}
              onChange={(e) => onUpdate("alt", e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Largura total</Label>
            <Switch checked={block.config.fullWidth ?? true} onCheckedChange={(v) => onUpdate("fullWidth", v)} />
          </div>
        </div>
      )}

      {block.block_type === "benefits" && (
        <div className="space-y-3">
          <Label className="text-xs">Itens (um por campo)</Label>
          {(block.config.items || []).map((item: string, i: number) => (
            <div key={i} className="flex gap-1.5">
              <Input
                value={item}
                onChange={(e) => {
                  const items = [...(block.config.items || [])];
                  items[i] = e.target.value;
                  onUpdate("items", items);
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-destructive"
                onClick={() => {
                  const items = (block.config.items || []).filter((_: any, idx: number) => idx !== i);
                  onUpdate("items", items);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => onUpdate("items", [...(block.config.items || []), "Novo benefício"])}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      )}

      {block.block_type === "badge" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto do selo</Label>
            <Input
              value={block.config.text || ""}
              onChange={(e) => onUpdate("text", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Estilo</Label>
            <div className="flex gap-1 mt-1">
              {[
                { v: "green", l: "Verde", c: "bg-primary" },
                { v: "gold", l: "Dourado", c: "bg-warning" },
                { v: "blue", l: "Azul", c: "bg-accent" },
              ].map((s) => (
                <button
                  key={s.v}
                  onClick={() => onUpdate("style", s.v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    block.config.style === s.v ? `${s.c} text-white` : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {block.block_type === "timer" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tempo (minutos)</Label>
            <Input
              type="number"
              value={block.config.minutes || 15}
              onChange={(e) => onUpdate("minutes", parseInt(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Texto</Label>
            <Input
              value={block.config.text || ""}
              onChange={(e) => onUpdate("text", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {block.block_type === "testimonial" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do autor</Label>
            <Input
              value={block.config.author || ""}
              onChange={(e) => onUpdate("author", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Depoimento</Label>
            <Textarea
              value={block.config.content || ""}
              onChange={(e) => onUpdate("content", e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Avaliação</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => onUpdate("rating", s)}>
                  <Star className={`h-5 w-5 ${s <= (block.config.rating || 5) ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <ImageUploadField
            label="Avatar (opcional)"
            value={block.config.avatar_url || ""}
            onUpdate={(url) => onUpdate("avatar_url", url)}
            placeholder="https://..."
          />
        </div>
      )}

      {block.block_type === "video" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">URL do vídeo</Label>
            <Input
              value={block.config.url || ""}
              onChange={(e) => onUpdate("url", e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="mt-1"
            />
          </div>
          <p className="text-[0.65rem] text-muted-foreground">YouTube, Vimeo ou link direto</p>
        </div>
      )}
    </div>
  );
}

/* ─── Block Preview ─── */
function BlockPreview({ block }: { block: Block }) {
  const c = block.config;

  switch (block.block_type) {
    case "text":
      return (
        <p className={`text-${c.size || "base"} text-${c.align || "left"} text-muted-foreground`}>
          {c.content || "Texto vazio — clique para editar"}
        </p>
      );

    case "headline":
      return (
        <p className={`text-${c.size || "2xl"} text-${c.align || "center"} ${c.bold ? "font-bold" : ""}`}>
          {c.text || "Título"}
        </p>
      );

    case "image":
      return c.url ? (
        <div className={`${c.fullWidth ? "w-full" : "max-w-md mx-auto"} aspect-[21/9] rounded-lg overflow-hidden`}>
          <img src={c.url} alt={c.alt || ""} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center justify-center aspect-[21/9] rounded-lg bg-muted border border-dashed border-border">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      );

    case "benefits":
      return (
        <ul className="space-y-1.5">
          {(c.items || []).map((item: string, i: number) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <ListChecks className="h-4 w-4 text-primary shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );

    case "badge": {
      const colors: Record<string, string> = {
        green: "bg-primary/10 text-primary border-primary/30",
        gold: "bg-warning/10 text-warning border-warning/30",
        blue: "bg-accent/10 text-accent border-accent/30",
      };
      return (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${colors[c.style || "green"]}`}>
          <Award className="h-4 w-4" />
          {c.text || "Selo"}
        </div>
      );
    }

    case "timer":
      return (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-warning/10 p-3">
          <Clock className="h-5 w-5 text-warning" />
          <span className="text-sm font-bold">{c.text || "Oferta expira em:"}</span>
          <span className="text-lg font-black tabular-nums text-warning">
            {String(c.minutes || 15).padStart(2, "0")}:00
          </span>
        </div>
      );

    case "testimonial":
      return (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {(c.author || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{c.author || "Autor"}</p>
              <div className="flex gap-0.5">
                {Array.from({ length: c.rating || 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{c.content || "Depoimento..."}</p>
        </div>
      );

    case "video":
      return c.url ? (
        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            src={getEmbedUrl(c.url)}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 rounded-lg bg-muted border border-dashed border-border">
          <Video className="h-8 w-8 text-muted-foreground" />
        </div>
      );

    default:
      return <p className="text-sm text-muted-foreground">Bloco desconhecido</p>;
  }
}

function getEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const vid = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v");
      return `https://www.youtube.com/embed/${vid}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const vid = u.pathname.split("/").pop();
      return `https://player.vimeo.com/video/${vid}`;
    }
  } catch {}
  return url;
}
