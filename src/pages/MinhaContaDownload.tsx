import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Download, FileText, Image, FileArchive, File, ExternalLink, Clock, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeLogo } from "@/components/ThemeLogo";
import MinhaContaLogin from "./MinhaContaLogin";
import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return Image;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  if (["pdf"].includes(ext)) return FileText;
  return File;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "pdf"].includes(ext);
}

function isImageFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
}

export default function MinhaContaDownload() {
  const { productId } = useParams<{ productId: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [authTrigger, setAuthTrigger] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["minha-conta-download", productId, user?.id, user?.email, authTrigger],
    queryFn: async () => {
      if (!user || !productId) return null;

      // Check access
      const { data: accessById } = await supabase
        .from("product_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .limit(1);

      const { data: accessByEmail } = await supabase
        .from("product_access")
        .select("id")
        .eq("buyer_email", user.email!)
        .eq("product_id", productId)
        .limit(1);

      const hasAccess = (accessById?.length ?? 0) > 0 || (accessByEmail?.length ?? 0) > 0;
      if (!hasAccess) return null;

      // Get product
      const { data: product } = await supabase
        .from("products")
        .select("id, title, description, cover_url, file_url, producer_id")
        .eq("id", productId)
        .single();

      if (!product) return null;

      // Get files
      const { data: files } = await supabase
        .from("product_files")
        .select("*")
        .eq("product_id", productId)
        .order("position");

      // Get producer name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", product.producer_id)
        .single();

      return {
        product: { ...product, producerName: profile?.display_name || "Produtor" },
        files: files || [],
      };
    },
    enabled: !!user && !!productId,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <MinhaContaLogin onAuth={() => setAuthTrigger((t) => t + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/minha-conta">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/">
            <ThemeLogo variant="horizontal" className="h-7 object-contain" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 space-y-4">
            <p className="font-medium text-foreground">Produto não encontrado</p>
            <p className="text-sm text-muted-foreground">
              Você não tem acesso a este produto ou ele não existe.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/minha-conta">Voltar</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Product Hero */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row gap-6"
            >
              {data.product.cover_url && (
                <div className="w-full sm:w-48 shrink-0 aspect-video sm:aspect-square rounded-xl overflow-hidden bg-muted/30">
                  <img
                    src={data.product.cover_url}
                    alt={data.product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Badge variant="outline" className="text-[0.65rem]">Download</Badge>
                <h1 className="text-2xl font-bold tracking-tight">{data.product.title}</h1>
                <p className="text-sm text-muted-foreground">por {data.product.producerName}</p>
                {data.product.description && (
                  <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line line-clamp-4">
                    {data.product.description}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Files Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Arquivos ({data.files.length > 0 ? data.files.length : data.product.file_url ? 1 : 0})
                </h2>
                {data.files.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      data.files.forEach((f: any) => {
                        const a = document.createElement("a");
                        a.href = f.file_url;
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        a.click();
                      });
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar todos
                  </Button>
                )}
              </div>

              <div className="grid gap-3">
                {data.files.length > 0 ? (
                  data.files.map((file: any, i: number) => {
                    const Icon = getFileIcon(file.file_name);
                    const canPreview = isPreviewable(file.file_name);
                    const isImage = isImageFile(file.file_name);

                    return (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors"
                      >
                        {/* Image preview */}
                        {isImage && (
                          <div
                            className="w-full h-40 bg-muted/20 flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => setPreviewUrl(previewUrl === file.file_url ? null : file.file_url)}
                          >
                            <img
                              src={file.file_url}
                              alt={file.file_name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}

                        <div className="p-4 flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatFileSize(file.file_size)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {canPreview && !isImage && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs gap-1.5"
                                asChild
                              >
                                <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Visualizar
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              asChild
                            >
                              <a href={file.file_url} target="_blank" rel="noopener noreferrer" download>
                                <Download className="h-3.5 w-3.5" />
                                Baixar
                              </a>
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : data.product.file_url ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <File className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Arquivo do produto</p>
                    </div>
                    <Button size="sm" className="h-8 text-xs gap-1.5" asChild>
                      <a href={data.product.file_url} target="_blank" rel="noopener noreferrer" download>
                        <Download className="h-3.5 w-3.5" />
                        Baixar
                      </a>
                    </Button>
                  </motion.div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum arquivo disponível para download.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Image Preview Lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
