import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Loader2,
  FileText,
  FileImage,
  FileArchive,
  FileVideo,
  FileAudio,
  X,
  Plus,
  Download,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  productId: string;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <FileImage className="h-5 w-5 text-blue-500" strokeWidth={1.5} />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return <FileArchive className="h-5 w-5 text-amber-500" strokeWidth={1.5} />;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext))
    return <FileVideo className="h-5 w-5 text-purple-500" strokeWidth={1.5} />;
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext))
    return <FileAudio className="h-5 w-5 text-pink-500" strokeWidth={1.5} />;
  if (["pdf"].includes(ext))
    return <FileText className="h-5 w-5 text-red-500" strokeWidth={1.5} />;
  return <FileText className="h-5 w-5 text-primary" strokeWidth={1.5} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function EditProductDownloadContent({ productId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["product-files", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_files")
        .select("*")
        .eq("product_id", productId)
        .order("position");
      return data || [];
    },
  });

  const uploadFile = async (file: File) => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/files/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-files").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-files").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    setUploading(true);
    try {
      const maxPos = files.length > 0
        ? Math.max(...files.map((f: any) => f.position ?? 0)) + 1
        : 0;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const url = await uploadFile(file);
        if (url) {
          await supabase.from("product_files").insert({
            product_id: productId,
            file_url: url,
            file_name: file.name,
            file_size: file.size,
            position: maxPos + i,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["product-files", productId] });
      toast.success(`${fileList.length} arquivo(s) adicionado(s)`);
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("product_files").delete().eq("id", deleteId);
    queryClient.invalidateQueries({ queryKey: ["product-files", productId] });
    setDeleteId(null);
    toast.success("Arquivo removido");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header card */}
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-primary/10 p-3">
            <Package className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Conteúdo Entregável</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adicione os arquivos que o comprador receberá após a compra. PDF, ZIP, vídeos, imagens e mais.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              {files.length} arquivo(s) adicionado(s)
            </Label>
          </div>
          {files.map((f: any) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5 bg-card hover:bg-muted/30 transition-colors"
            >
              {getFileIcon(f.file_name)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.file_name}</p>
                <p className="text-[0.65rem] text-muted-foreground">
                  {f.file_size > 0 ? formatSize(f.file_size) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(f.file_url, "_blank")}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(f.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Upload area */}
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all">
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            {files.length === 0 ? (
              <Upload className="h-8 w-8 text-muted-foreground mb-2" strokeWidth={1} />
            ) : (
              <Plus className="h-8 w-8 text-muted-foreground mb-2" strokeWidth={1} />
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {files.length === 0 ? "Enviar arquivos entregáveis" : "Adicionar mais arquivos"}
            </span>
            <span className="text-[0.65rem] text-muted-foreground mt-1">
              PDF, ZIP, MP4, MP3, imagens e mais
            </span>
          </>
        )}
        <input type="file" className="hidden" multiple onChange={handleAddFiles} />
      </label>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover arquivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este arquivo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
