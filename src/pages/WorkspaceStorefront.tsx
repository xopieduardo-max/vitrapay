import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Download, PlayCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceStorefront() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch workspace by slug
  const { data: workspace, isLoading: loadingWs } = useQuery({
    queryKey: ["workspace-storefront", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .eq("slug", slug)
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

  // Fetch buyer's access
  const { data: accessList = [] } = useQuery({
    queryKey: ["buyer-access", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("product_access")
        .select("product_id")
        .or(`user_id.eq.${user.id},buyer_email.eq.${user.email}`);
      return (data || []).map((a: any) => a.product_id);
    },
    enabled: !!user,
  });

  // Fetch product files for download products
  const { data: filesMap = {} } = useQuery({
    queryKey: ["workspace-product-files", items.map((i: any) => i.id).join(",")],
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

  const hasAccess = (productId: string) => accessList.includes(productId);

  const handleProductClick = (product: any) => {
    if (!hasAccess(product.id)) {
      navigate(`/checkout/${product.id}`);
      return;
    }
    if (product.type === "lms") {
      navigate(`/learn/${product.id}`);
    }
    // Download products show files inline
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: workspace.secondary_color || "#1A1A1A" }}
    >
      {/* Banner */}
      {workspace.banner_url ? (
        <div className="w-full max-h-[200px] overflow-hidden">
          <img
            src={workspace.banner_url}
            alt="Banner"
            className="w-full h-[200px] object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full h-[120px]"
          style={{
            background: `linear-gradient(135deg, ${workspace.primary_color || "#EAB308"}, ${workspace.secondary_color || "#1A1A1A"})`,
          }}
        />
      )}

      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-10">
        <div className="flex items-end gap-4 mb-6">
          {workspace.logo_url && (
            <img
              src={workspace.logo_url}
              alt="Logo"
              className="h-16 w-16 rounded-xl border-4 border-background object-contain bg-background shadow-lg"
            />
          )}
          <div className="pb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm">
              {workspace.name}
            </h1>
            {workspace.description && (
              <p className="text-sm text-white/70 mt-0.5 line-clamp-2">{workspace.description}</p>
            )}
          </div>
        </div>

        {/* Products grid */}
        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/50">Nenhum conteúdo disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            {items.map((product: any) => {
              const owned = hasAccess(product.id);
              const files = filesMap[product.id] || [];

              return (
                <div key={product.id} className="group">
                  <div
                    className="rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 transition-all cursor-pointer"
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
                          style={{ backgroundColor: workspace.primary_color + "22" }}
                        >
                          {product.type === "lms" ? (
                            <PlayCircle className="h-10 w-10 text-white/30" />
                          ) : (
                            <Download className="h-10 w-10 text-white/30" />
                          )}
                        </div>
                      )}
                      {/* Overlay badge */}
                      <div className="absolute top-2 right-2">
                        {owned ? (
                          <span
                            className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full text-black"
                            style={{ backgroundColor: workspace.primary_color || "#EAB308" }}
                          >
                            {product.type === "lms" ? "ACESSAR" : "LIBERADO"}
                          </span>
                        ) : (
                          <span className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            COMPRAR
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-white truncate">{product.title}</h3>
                      <p className="text-[0.65rem] text-white/50 mt-0.5">
                        {product.type === "lms" ? "Curso" : "Entregável"}
                      </p>

                      {/* Show download files if owned & is download */}
                      {owned && product.type === "download" && files.length > 0 && (
                        <div className="mt-2 space-y-1" onClick={e => e.stopPropagation()}>
                          {files.map((f: any) => (
                            <a
                              key={f.id}
                              href={f.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs hover:underline rounded px-2 py-1 hover:bg-white/10 transition-colors"
                              style={{ color: workspace.primary_color || "#EAB308" }}
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

      {/* Login prompt if not authenticated */}
      {!user && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="max-w-md mx-auto text-center">
            <p className="text-white/80 text-sm mb-3">Faça login para acessar seus produtos</p>
            <Button
              onClick={() => navigate("/minha-conta")}
              style={{ backgroundColor: workspace.primary_color || "#EAB308", color: "#000" }}
            >
              Entrar na minha conta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
