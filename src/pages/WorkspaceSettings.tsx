import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Image, Upload, X, Eye, GripVertical, ExternalLink, Copy, Check } from "lucide-react";

export default function WorkspaceSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: "Meu Workspace",
    slug: "",
    description: "",
    logo_url: "",
    banner_url: "",
    banner_position: 50,
    primary_color: "#EAB308",
    secondary_color: "#1A1A1A",
    is_public: true,
  });
  const [editingBannerPos, setEditingBannerPos] = useState(false);
  const bannerDragRef = useRef<{ startY: number; startPos: number } | null>(null);

  // Fetch or create workspace
  const { data: workspace, isLoading } = useQuery({
    queryKey: ["my-workspace", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .eq("producer_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch producer products
  const { data: products = [] } = useQuery({
    queryKey: ["workspace-products-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("products")
        .select("id, title, cover_url, type, is_published")
        .eq("producer_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch workspace-product links
  const { data: linkedProducts = [] } = useQuery({
    queryKey: ["workspace-linked-products", workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from("workspace_products")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("position");
      return data || [];
    },
    enabled: !!workspace,
  });

  useEffect(() => {
    if (workspace) {
      setForm({
        name: workspace.name || "Meu Workspace",
        slug: workspace.slug || "",
        description: workspace.description || "",
        logo_url: workspace.logo_url || "",
        banner_url: workspace.banner_url || "",
        banner_position: (workspace as any).banner_position ?? 50,
        primary_color: workspace.primary_color || "#EAB308",
        secondary_color: workspace.secondary_color || "#1A1A1A",
        is_public: workspace.is_public ?? true,
      });
    } else if (user && !isLoading) {
      // Auto-generate slug from user id
      setForm(f => ({ ...f, slug: user.id.slice(0, 8) }));
    }
  }, [workspace, user, isLoading]);

  const uploadFile = async (file: File, folder: string) => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-files").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-files").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url" | "banner_url",
    setUploading: (v: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, field === "logo_url" ? "logos" : "banners");
      if (url) setForm(f => ({ ...f, [field]: url }));
    } catch {
      toast.error("Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
      if (!slug) {
        toast.error("Slug é obrigatório");
        setSaving(false);
        return;
      }

      if (workspace) {
        const { error } = await supabase
          .from("workspaces")
          .update({ ...form, slug, updated_at: new Date().toISOString() })
          .eq("id", workspace.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workspaces")
          .insert({ ...form, slug, producer_id: user.id });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["my-workspace"] });
      toast.success("Workspace salvo!");
    } catch (err: any) {
      if (err?.message?.includes("duplicate")) {
        toast.error("Esse slug já está em uso. Escolha outro.");
      } else {
        toast.error("Erro ao salvar workspace");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = async (productId: string) => {
    if (!workspace) {
      toast.error("Salve o workspace primeiro");
      return;
    }
    const existing = linkedProducts.find((lp: any) => lp.product_id === productId);
    if (existing) {
      await supabase.from("workspace_products").delete().eq("id", existing.id);
    } else {
      await supabase.from("workspace_products").insert({
        workspace_id: workspace.id,
        product_id: productId,
        position: linkedProducts.length,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["workspace-linked-products"] });
  };

  const toggleVisibility = async (wpId: string, current: boolean) => {
    await supabase.from("workspace_products").update({ is_visible: !current }).eq("id", wpId);
    queryClient.invalidateQueries({ queryKey: ["workspace-linked-products"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewUrl = workspace ? `/w/${workspace.slug}` : form.slug ? `/w/${form.slug}` : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspace</h1>
          <p className="text-sm text-muted-foreground">Configure sua vitrine para os compradores</p>
        </div>
        <div className="flex gap-2">
          {previewUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-1" /> Visualizar
              </a>
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Nome do Workspace</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Slug (URL)</Label>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground shrink-0">/w/</span>
                <Input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm font-medium">Workspace público</Label>
                <p className="text-[0.65rem] text-muted-foreground">Visível para qualquer pessoa</p>
              </div>
              <Switch
                checked={form.is_public}
                onCheckedChange={v => setForm(f => ({ ...f, is_public: v }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right: Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div>
              <Label className="text-xs">Logo</Label>
              <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors">
                {uploadingLogo ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : form.logo_url ? (
                  <div className="relative">
                    <img src={form.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded" />
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setForm(f => ({ ...f, logo_url: "" })); }}
                      className="absolute -top-1 -right-1 rounded-full bg-background/80 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground py-1">
                    <Upload className="h-5 w-5" strokeWidth={1} />
                    <span className="text-xs">Enviar logo</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, "logo_url", setUploadingLogo)} />
              </label>
            </div>

            {/* Banner */}
            <div>
              <Label className="text-xs">Banner (1920×320 recomendado)</Label>
              {form.banner_url ? (
                <div className="mt-1 space-y-2">
                  <div
                    className="relative w-full h-24 rounded-lg overflow-hidden border border-border group"
                    style={{ cursor: editingBannerPos ? "grab" : "default" }}
                    onMouseDown={(e) => {
                      if (!editingBannerPos) return;
                      e.preventDefault();
                      bannerDragRef.current = { startY: e.clientY, startPos: form.banner_position };
                      const onMove = (ev: MouseEvent) => {
                        if (!bannerDragRef.current) return;
                        const delta = bannerDragRef.current.startY - ev.clientY;
                        const newPos = Math.min(100, Math.max(0, bannerDragRef.current.startPos + delta * 0.5));
                        setForm(f => ({ ...f, banner_position: Math.round(newPos) }));
                      };
                      const onUp = () => {
                        bannerDragRef.current = null;
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                    onTouchStart={(e) => {
                      if (!editingBannerPos) return;
                      const touch = e.touches[0];
                      bannerDragRef.current = { startY: touch.clientY, startPos: form.banner_position };
                      const onMove = (ev: TouchEvent) => {
                        if (!bannerDragRef.current) return;
                        const delta = bannerDragRef.current.startY - ev.touches[0].clientY;
                        const newPos = Math.min(100, Math.max(0, bannerDragRef.current.startPos + delta * 0.5));
                        setForm(f => ({ ...f, banner_position: Math.round(newPos) }));
                      };
                      const onUp = () => {
                        bannerDragRef.current = null;
                        window.removeEventListener("touchmove", onMove);
                        window.removeEventListener("touchend", onUp);
                      };
                      window.addEventListener("touchmove", onMove);
                      window.addEventListener("touchend", onUp);
                    }}
                  >
                    <img
                      src={form.banner_url}
                      alt="Banner"
                      className="w-full h-full object-cover pointer-events-none select-none"
                      style={{ objectPosition: `center ${form.banner_position}%` }}
                      draggable={false}
                    />
                    {editingBannerPos && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <p className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full">
                          ↕ Arraste para reposicionar
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={editingBannerPos ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setEditingBannerPos(!editingBannerPos)}
                    >
                      {editingBannerPos ? "Concluir" : "Reposicionar"}
                    </Button>
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 pointer-events-none">
                        Trocar imagem
                      </Button>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, "banner_url", setUploadingBanner)} />
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, banner_url: "", banner_position: 50 })); setEditingBannerPos(false); }}
                      className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors">
                  {uploadingBanner ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground py-2">
                      <Image className="h-5 w-5" strokeWidth={1} />
                      <span className="text-xs">Enviar banner</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, "banner_url", setUploadingBanner)} />
                </label>
              )}
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cor primária</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cor secundária</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.secondary_color}
                    onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={form.secondary_color}
                    onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products in workspace */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtos na Vitrine</CardTitle>
          <CardDescription>Escolha quais produtos aparecem para os compradores</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Você ainda não tem produtos</p>
          ) : (
            <div className="space-y-2">
              {products.map((p: any) => {
                const linked = linkedProducts.find((lp: any) => lp.product_id === p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                  >
                    {p.cover_url ? (
                      <img src={p.cover_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-[0.6rem] text-muted-foreground">
                        {p.type === "lms" ? "Área de Membros" : "Download"}
                        {!p.is_published && " · Rascunho"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {linked && (
                        <button
                          onClick={() => toggleVisibility(linked.id, linked.is_visible)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          title={linked.is_visible ? "Visível" : "Oculto"}
                        >
                          <Eye className={`h-4 w-4 ${linked.is_visible ? "text-primary" : "text-muted-foreground/40"}`} />
                        </button>
                      )}
                      <Switch
                        checked={!!linked}
                        onCheckedChange={() => toggleProduct(p.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
