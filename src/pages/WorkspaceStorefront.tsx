import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Download, PlayCircle, Lock, ArrowLeft, Eye, EyeOff, Move, ImagePlus } from "lucide-react";
import { compressImage } from "@/lib/imageCompressor";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useRef, useCallback } from "react";
import { toast } from "sonner";

/** Returns true if the color is "light" (text should be dark) */
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default function WorkspaceStorefront() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Producer controls
  const [viewAsClient, setViewAsClient] = useState(false);
  const [editingBannerPos, setEditingBannerPos] = useState(false);
  const [bannerPos, setBannerPos] = useState<number | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerDragRef = useRef<{ startY: number; startPos: number } | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Fetch workspace by slug
  const { data: workspace, isLoading: loadingWs } = useQuery({
    queryKey: ["workspace-storefront", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      return data;
    },
    enabled: !!slug,
  });

  // Fetch workspace products with product details
  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["workspace-storefront-products", workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data: wpData } = await supabase
        .from("workspace_products")
        .select("*, products(*)")
        .eq("workspace_id", workspace.id)
        .eq("is_visible", true)
        .order("position");

      return (wpData || [])
        .filter((wp: any) => wp.products?.is_published)
        .map((wp: any) => wp.products);
    },
    enabled: !!workspace,
  });

  // Stable product IDs for dependent queries
  const productIds = useMemo(() => items.map((i: any) => i.id).sort().join(","), [items]);

  // Fetch buyer's access — guard against missing email
  const { data: accessList = [] } = useQuery({
    queryKey: ["buyer-access", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const filters = [`user_id.eq.${user.id}`];
      if (user.email) {
        filters.push(`buyer_email.eq.${user.email}`);
      }
      const { data } = await supabase
        .from("product_access")
        .select("product_id")
        .or(filters.join(","));
      return (data || []).map((a: any) => a.product_id);
    },
    enabled: !!user,
  });

  // Fetch product files for download products — stable query key
  const { data: filesMap = {} } = useQuery({
    queryKey: ["workspace-product-files", productIds],
    queryFn: async () => {
      if (items.length === 0) return {};
      const downloadProducts = items.filter((p: any) => p.type === "download" && accessList.includes(p.id));
      if (downloadProducts.length === 0) return {};
      const { data } = await supabase
        .from("product_files")
        .select("*")
        .in("product_id", downloadProducts.map((p: any) => p.id))
        .order("position");
      const map: Record<string, any[]> = {};
      (data || []).forEach((f: any) => {
        if (!map[f.product_id]) map[f.product_id] = [];
        map[f.product_id].push(f);
      });
      return map;
    },
    enabled: items.length > 0 && accessList.length > 0,
  });

  const handleBannerMouseDown = useCallback((e: React.MouseEvent, pos: number) => {
    if (!editingBannerPos) return;
    e.preventDefault();
    bannerDragRef.current = { startY: e.clientY, startPos: pos };
    const onMove = (ev: MouseEvent) => {
      if (!bannerDragRef.current) return;
      const delta = ev.clientY - bannerDragRef.current.startY;
      const newPos = Math.max(0, Math.min(100, bannerDragRef.current.startPos + delta * 0.5));
      setBannerPos(Math.round(newPos));
    };
    const onUp = () => {
      bannerDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [editingBannerPos]);

  const saveBannerPosition = useCallback(async (workspaceId: string) => {
    if (bannerPos === null) return;
    await supabase
      .from("workspaces")
      .update({ banner_position: bannerPos })
      .eq("id", workspaceId);
    queryClient.invalidateQueries({ queryKey: ["workspace-storefront", slug] });
    setEditingBannerPos(false);
    toast.success("Posição do banner salva!");
  }, [bannerPos, queryClient, slug]);

  const handleBannerUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, workspaceId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 600, quality: 0.85 });
      const ext = compressed.type === "image/webp" ? "webp" : "jpg";
      const path = `workspace-banners/${workspaceId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("checkout-images")
        .upload(path, compressed, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("checkout-images").getPublicUrl(path);
      const banner_url = urlData.publicUrl + "?t=" + Date.now();
      await supabase.from("workspaces").update({ banner_url }).eq("id", workspaceId);
      queryClient.invalidateQueries({ queryKey: ["workspace-storefront", slug] });
      toast.success("Banner atualizado!");
    } catch (err: any) {
      toast.error("Erro ao enviar banner: " + err.message);
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }, [queryClient, slug]);

  if (loadingWs || loadingItems) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold">Workspace não encontrado</h1>
        <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  const isProducer = !!user && workspace.producer_id === user.id;
  const showProducerControls = isProducer && !viewAsClient;

  const bgColor = workspace.secondary_color || "#1A1A1A";
  const accentColor = workspace.primary_color || "#EAB308";
  const lightBg = isLightColor(bgColor);
  const textColor = lightBg ? "#1A1A1A" : "#FFFFFF";
  const textMuted = lightBg ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
  const textSecondary = lightBg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)";
  const cardBg = lightBg ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
  const cardBorder = lightBg ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";
  const cardBorderHover = lightBg ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)";
  const lightAccent = isLightColor(accentColor);
  const accentTextColor = lightAccent ? "#000" : "#FFF";

  const currentBannerPos = bannerPos ?? (workspace.banner_position ?? 50);

  const hasAccess = (productId: string) => accessList.includes(productId);

  const handleProductClick = (product: any) => {
    // Producer view: open product edit page
    if (showProducerControls) {
      navigate(`/products/${product.id}/edit`);
      return;
    }
    // Client view (or actual client): checkout or access
    if (!hasAccess(product.id)) {
      navigate(`/checkout/${product.id}`);
      return;
    }
    if (product.type === "lms") {
      navigate(`/learn/${product.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* Producer toolbar */}
      {isProducer && (
        <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 bg-black/90 backdrop-blur-sm text-white text-sm">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10 gap-1.5"
            onClick={() => navigate("/workspace")}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10 gap-1.5"
            onClick={() => setViewAsClient(!viewAsClient)}
          >
            {viewAsClient ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {viewAsClient ? "Visão produtor" : "Visão cliente"}
          </Button>
        </div>
      )}

      {/* Banner */}
      {workspace.banner_url ? (
        <div
          ref={bannerRef}
          className="w-full max-h-[200px] overflow-hidden relative"
          style={{ cursor: editingBannerPos ? "ns-resize" : undefined }}
          onMouseDown={(e) => handleBannerMouseDown(e, currentBannerPos)}
        >
          <img
            src={workspace.banner_url}
            alt="Banner"
            className="w-full h-[200px] object-cover select-none"
            style={{ objectPosition: `center ${currentBannerPos}%` }}
            draggable={false}
          />
          {showProducerControls && !editingBannerPos && (
            <div className="absolute top-2 left-2 flex gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-black/60 hover:bg-black/80 text-white border-0"
                onClick={() => { setEditingBannerPos(true); setBannerPos(currentBannerPos); }}
              >
                <Move className="h-3 w-3" /> Ajustar posição
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-black/60 hover:bg-black/80 text-white border-0"
                disabled={uploadingBanner}
                onClick={() => bannerInputRef.current?.click()}
              >
                {uploadingBanner ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                Trocar banner
              </Button>
            </div>
          )}
          {showProducerControls && editingBannerPos && (
            <div className="absolute top-2 left-2 flex gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white border-0"
                onClick={() => saveBannerPosition(workspace.id)}
              >
                Salvar
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-black/60 hover:bg-black/80 text-white border-0"
                onClick={() => { setEditingBannerPos(false); setBannerPos(null); }}
              >
                Cancelar
              </Button>
            </div>
          )}
          {editingBannerPos && (
            <div className="absolute inset-0 border-2 border-dashed border-white/50 pointer-events-none flex items-center justify-center">
              <span className="bg-black/60 text-white text-xs px-2 py-1 rounded">Arraste para reposicionar</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className="w-full h-[120px] relative"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${bgColor})`,
          }}
        >
          {showProducerControls && (
            <div className="absolute top-2 left-2">
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-black/60 hover:bg-black/80 text-white border-0"
                disabled={uploadingBanner}
                onClick={() => bannerInputRef.current?.click()}
              >
                {uploadingBanner ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                Adicionar banner
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hidden banner file input */}
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => workspace && handleBannerUpload(e, workspace.id)}
      />

      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 flex-1 w-full">
        <div className="flex items-end gap-4 mb-6">
          {workspace.logo_url && (
            <img
              src={workspace.logo_url}
              alt="Logo"
              className="h-16 w-16 rounded-xl border-4 object-contain shadow-lg"
              style={{
                borderColor: bgColor,
                backgroundColor: bgColor,
              }}
            />
          )}
          <div className="pb-1">
            <h1
              className="text-xl sm:text-2xl font-bold drop-shadow-sm"
              style={{ color: textColor }}
            >
              {workspace.name}
            </h1>
            {workspace.description && (
              <p className="text-sm mt-0.5 line-clamp-2" style={{ color: textSecondary }}>
                {workspace.description}
              </p>
            )}
          </div>
        </div>

        {/* Products grid */}
        {items.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: textMuted }}>Nenhum conteúdo disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            {items.map((product: any) => {
              const owned = hasAccess(product.id);
              const files = filesMap[product.id] || [];

              return (
                <div key={product.id} className="group">
                  <div
                    className="rounded-xl overflow-hidden transition-all cursor-pointer"
                    style={{
                      border: `1px solid ${cardBorder}`,
                      backgroundColor: cardBg,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = cardBorderHover)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = cardBorder)}
                    onClick={() => handleProductClick(product)}
                  >
                    {/* Cover */}
                    <div className="relative aspect-video overflow-hidden">
                      {product.cover_url ? (
                        <img
                          src={product.cover_url}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: accentColor + "22" }}
                        >
                          {product.type === "lms" ? (
                            <PlayCircle className="h-10 w-10" style={{ color: textMuted }} />
                          ) : (
                            <Download className="h-10 w-10" style={{ color: textMuted }} />
                          )}
                        </div>
                      )}
                      {/* Overlay badge */}
                      <div className="absolute top-2 right-2">
                        {owned ? (
                          <span
                            className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: accentColor, color: accentTextColor }}
                          >
                            {product.type === "lms" ? "ACESSAR" : "LIBERADO"}
                          </span>
                        ) : (
                          <span
                            className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1"
                            style={{
                              backgroundColor: lightBg ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)",
                              color: textColor,
                            }}
                          >
                            <Lock className="h-2.5 w-2.5" />
                            COMPRAR
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="text-sm font-semibold truncate" style={{ color: textColor }}>
                        {product.title}
                      </h3>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[0.65rem]" style={{ color: textMuted }}>
                          {product.type === "lms" ? "Curso" : "Entregável"}
                        </p>
                        {!owned && product.price > 0 && (
                          <p className="text-xs font-bold" style={{ color: accentColor }}>
                            {formatPrice(product.price)}
                          </p>
                        )}
                      </div>

                      {/* Show download files if owned & is download */}
                      {owned && product.type === "download" && files.length > 0 && (
                        <div className="mt-2 space-y-1" onClick={e => e.stopPropagation()}>
                          {files.map((f: any) => (
                            <a
                              key={f.id}
                              href={f.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs hover:underline rounded px-2 py-1 transition-colors"
                              style={{ color: accentColor }}
                            >
                              <Download className="h-3 w-3 shrink-0" />
                              <span className="truncate">{f.file_name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center" style={{ borderTop: `1px solid ${cardBorder}` }}>
        <p className="text-[0.65rem]" style={{ color: textMuted }}>
          Powered by{" "}
          <a
            href="/"
            className="font-semibold hover:underline"
            style={{ color: accentColor }}
          >
            VitraPay
          </a>
        </p>
      </footer>

      {/* Login prompt if not authenticated */}
      {!user && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="max-w-md mx-auto text-center">
            <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.8)" }}>
              Faça login para acessar seus produtos
            </p>
            <Button
              onClick={() => navigate("/minha-conta")}
              style={{ backgroundColor: accentColor, color: accentTextColor }}
            >
              Entrar na minha conta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
