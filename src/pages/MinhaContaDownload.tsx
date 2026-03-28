import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Download, FileText, Image, FileArchive, File, ExternalLink, Clock, BarChart3, FileAudio, FileVideo, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { MediaPlayer } from "@/components/download/MediaPlayer";
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
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) return FileAudio;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return FileVideo;
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

function isAudioFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext);
}

function isPdfFile(name: string) {
  return name.split(".").pop()?.toLowerCase() === "pdf";
}

function isVideoFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["mp4", "mov", "webm"].includes(ext);
}

export default function MinhaContaDownload() {
  const { productId } = useParams<{ productId: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [authTrigger, setAuthTrigger] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expandedPdfs, setExpandedPdfs] = useState<Set<string>>(new Set());

  const togglePdf = (fileId: string) => {
    setExpandedPdfs((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

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

  // Download stats
  const { data: stats } = useQuery({
    queryKey: ["download-stats", productId, user?.id],
    queryFn: async () => {
      if (!user || !productId) return null;
      const { data } = await supabase
        .from("product_download_stats")
        .select("download_count, last_accessed_at")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!productId,
  });

  const trackDownload = useCallback(async () => {
    if (!user || !productId) return;
    if (stats) {
      await supabase
        .from("product_download_stats")
        .update({
          download_count: (stats.download_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id)
        .eq("product_id", productId);
    } else {
      await supabase
        .from("product_download_stats")
        .insert({
          user_id: user.id,
          product_id: productId,
          download_count: 1,
          last_accessed_at: new Date().toISOString(),
        } as any);
    }
    queryClient.invalidateQueries({ queryKey: ["download-stats", productId, user.id] });
  }, [user, productId, stats, queryClient]);

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
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[0.65rem]">Download</Badge>
                  {stats && (
                    <>
                      <Badge variant="secondary" className="text-[0.65rem] gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {stats.download_count} download{stats.download_count !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="secondary" className="text-[0.65rem] gap-1">
                        <Clock className="h-3 w-3" />
                        Último acesso {formatDistanceToNow(new Date(stats.last_accessed_at), { addSuffix: true, locale: ptBR })}
                      </Badge>
                    </>
                  )}
                </div>
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
                      trackDownload();
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
                    const isImage = isImageFile(file.file_name);
                    const isAudio = isAudioFile(file.file_name);
                    const isPdf = isPdfFile(file.file_name);
                    const isVideo = isVideoFile(file.file_name);
                    const pdfExpanded = expandedPdfs.has(file.id);

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

                        {/* Audio player with progress tracking */}
                        {isAudio && user && (
                          <MediaPlayer
                            type="audio"
                            fileUrl={file.file_url}
                            fileId={file.id}
                            productId={productId!}
                            userId={user.id}
                          />
                        )}

                        {/* Video player with progress tracking */}
                        {isVideo && user && (
                          <MediaPlayer
                            type="video"
                            fileUrl={file.file_url}
                            fileId={file.id}
                            productId={productId!}
                            userId={user.id}
                          />
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
                            {isPdf && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs gap-1.5"
                                onClick={() => togglePdf(file.id)}
                              >
                                {pdfExpanded ? (
                                  <><EyeOff className="h-3.5 w-3.5" /> Fechar</>
                                ) : (
                                  <><Eye className="h-3.5 w-3.5" /> Visualizar</>
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => {
                                trackDownload();
                                const a = document.createElement("a");
                                a.href = file.file_url;
                                a.target = "_blank";
                                a.rel = "noopener noreferrer";
                                a.download = file.file_name;
                                a.click();
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Baixar
                            </Button>
                          </div>
                        </div>

                        {/* Embedded PDF viewer */}
                        {isPdf && pdfExpanded && (
                          <div className="border-t border-border">
                            <iframe
                              src={`${file.file_url}#toolbar=1&navpanes=0`}
                              className="w-full h-[70vh] bg-muted/10"
                              title={file.file_name}
                            />
                          </div>
                        )}
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
                    <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
                      trackDownload();
                      const a = document.createElement("a");
                      a.href = data.product.file_url!;
                      a.target = "_blank";
                      a.download = "arquivo";
                      a.click();
                    }}>
                      <Download className="h-3.5 w-3.5" />
                      Baixar
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
