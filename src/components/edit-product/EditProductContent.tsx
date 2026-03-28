import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Trash2,
  Upload,
  Image,
  X,
  GripVertical,
  PlayCircle,
  FileText,
  Pencil,
  Video,
  Eye,
  Download,
  Paperclip,
} from "lucide-react";

interface Props {
  productId: string;
}

export default function EditProductContent({ productId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Module dialog state
  const [moduleDialog, setModuleDialog] = useState<{
    open: boolean;
    editing?: any;
  }>({ open: false });
  const [moduleForm, setModuleForm] = useState({
    title: "",
    description: "",
    cover_url: "",
  });
  const [savingModule, setSavingModule] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Lesson dialog state
  const [lessonDialog, setLessonDialog] = useState<{
    open: boolean;
    moduleId?: string;
    editing?: any;
  }>({ open: false });
  const [lessonForm, setLessonForm] = useState({
    title: "",
    description: "",
    video_url: "",
    content: "",
    duration_minutes: 0,
    is_free: false,
  });
  const [savingLesson, setSavingLesson] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lessonFiles, setLessonFiles] = useState<{ id?: string; file_name: string; file_url: string; file_size: number }[]>([]);
  const [uploadingLessonFile, setUploadingLessonFile] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: "module" | "lesson";
    id: string;
    title: string;
  } | null>(null);

  // Fetch modules
  const { data: modules = [], isLoading: loadingModules } = useQuery({
    queryKey: ["product-modules", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("modules")
        .select("*")
        .eq("product_id", productId)
        .order("position");
      return data || [];
    },
  });

  // Fetch lessons for all modules
  const moduleIds = modules.map((m: any) => m.id);
  const { data: allLessons = [] } = useQuery({
    queryKey: ["product-lessons", moduleIds.join(",")],
    queryFn: async () => {
      if (moduleIds.length === 0) return [];
      const { data } = await supabase
        .from("lessons")
        .select("*")
        .in("module_id", moduleIds)
        .order("position");
      return data || [];
    },
    enabled: moduleIds.length > 0,
  });

  const getLessonsForModule = (moduleId: string) =>
    allLessons.filter((l: any) => l.module_id === moduleId);

  // Upload cover image
  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `modules/${productId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-files")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage
        .from("product-files")
        .getPublicUrl(path);
      setModuleForm((f) => ({ ...f, cover_url: data.publicUrl }));
    } catch {
      toast.error("Erro no upload da capa");
    } finally {
      setUploadingCover(false);
    }
  };

  // Module CRUD
  const openNewModule = () => {
    setModuleForm({ title: "", description: "", cover_url: "" });
    setModuleDialog({ open: true });
  };

  const openEditModule = (mod: any) => {
    setModuleForm({
      title: mod.title,
      description: mod.description || "",
      cover_url: (mod as any).cover_url || "",
    });
    setModuleDialog({ open: true, editing: mod });
  };

  const saveModule = async () => {
    if (!moduleForm.title.trim()) {
      toast.error("Nome do módulo é obrigatório");
      return;
    }
    setSavingModule(true);
    try {
      if (moduleDialog.editing) {
        const { error } = await supabase
          .from("modules")
          .update({
            title: moduleForm.title,
            description: moduleForm.description || null,
            cover_url: moduleForm.cover_url || null,
          } as any)
          .eq("id", moduleDialog.editing.id);
        if (error) throw error;
        toast.success("Módulo atualizado!");
      } else {
        const { error } = await supabase.from("modules").insert({
          product_id: productId,
          title: moduleForm.title,
          description: moduleForm.description || null,
          cover_url: moduleForm.cover_url || null,
          position: modules.length,
        } as any);
        if (error) throw error;
        toast.success("Módulo criado!");
      }
      setModuleDialog({ open: false });
      queryClient.invalidateQueries({
        queryKey: ["product-modules", productId],
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar módulo");
    } finally {
      setSavingModule(false);
    }
  };

  const deleteModule = async (id: string) => {
    await supabase.from("lessons").delete().eq("module_id", id);
    await supabase.from("modules").delete().eq("id", id);
    queryClient.invalidateQueries({
      queryKey: ["product-modules", productId],
    });
    queryClient.invalidateQueries({ queryKey: ["product-lessons"] });
    toast.success("Módulo excluído");
  };

  // Lesson CRUD
  const openNewLesson = (moduleId: string) => {
    setLessonForm({
      title: "",
      description: "",
      video_url: "",
      content: "",
      duration_minutes: 0,
      is_free: false,
    });
    setLessonFiles([]);
    setLessonDialog({ open: true, moduleId });
  };

  const openEditLesson = async (lesson: any) => {
    setLessonForm({
      title: lesson.title,
      description: lesson.description || "",
      video_url: lesson.video_url || "",
      content: lesson.content || "",
      duration_minutes: lesson.duration_minutes || 0,
      is_free: lesson.is_free || false,
    });
    // Load existing files for this lesson
    const { data: files } = await supabase
      .from("lesson_files")
      .select("*")
      .eq("lesson_id", lesson.id)
      .order("position");
    setLessonFiles((files || []).map((f: any) => ({
      id: f.id,
      file_name: f.file_name,
      file_url: f.file_url,
      file_size: f.file_size || 0,
    })));
    setLessonDialog({ open: true, moduleId: lesson.module_id, editing: lesson });
  };

  // Upload video file with progress
  const uploadVideo = async (file: File) => {
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      toast.error("Arquivo muito grande. Máximo: 500MB");
      return;
    }
    setUploadingVideo(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split(".").pop();
      const path = `lessons/${productId}/${crypto.randomUUID()}.${ext}`;

      // Use XMLHttpRequest for progress tracking
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || supabaseKey;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload falhou: ${xhr.statusText}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Erro de rede")));
        xhr.open("POST", `${supabaseUrl}/storage/v1/object/product-files/${path}`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.send(file);
      });

      const { data } = supabase.storage
        .from("product-files")
        .getPublicUrl(path);
      setLessonForm((f) => ({ ...f, video_url: data.publicUrl }));
      toast.success("Vídeo enviado!");
    } catch (e: any) {
      toast.error(e.message || "Erro no upload do vídeo");
    } finally {
      setUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  // Upload lesson material file
  const uploadLessonFile = async (file: File) => {
    setUploadingLessonFile(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `lesson-materials/${productId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-files").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-files").getPublicUrl(path);
      setLessonFiles(prev => [...prev, {
        file_name: file.name,
        file_url: data.publicUrl,
        file_size: file.size,
      }]);
      toast.success("Arquivo anexado!");
    } catch {
      toast.error("Erro no upload do arquivo");
    } finally {
      setUploadingLessonFile(false);
    }
  };

  const removeLessonFile = (index: number) => {
    setLessonFiles(prev => prev.filter((_, i) => i !== index));
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) {
      toast.error("Nome da aula é obrigatório");
      return;
    }
    if (!lessonDialog.moduleId && !lessonDialog.editing) {
      toast.error("Módulo não identificado");
      return;
    }
    setSavingLesson(true);
    try {
      let lessonId: string;

      if (lessonDialog.editing) {
        lessonId = lessonDialog.editing.id;
        const { error } = await supabase
          .from("lessons")
          .update({
            title: lessonForm.title,
            description: lessonForm.description || null,
            video_url: lessonForm.video_url || null,
            content: lessonForm.content || null,
            duration_minutes: lessonForm.duration_minutes || 0,
            is_free: lessonForm.is_free,
          })
          .eq("id", lessonId);
        if (error) throw error;

        // Sync files: delete removed, insert new
        const existingIds = lessonFiles.filter(f => f.id).map(f => f.id!);
        // Delete files that were removed
        await supabase
          .from("lesson_files")
          .delete()
          .eq("lesson_id", lessonId)
          .not("id", "in", `(${existingIds.length > 0 ? existingIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);

        // Insert new files (no id)
        const newFiles = lessonFiles.filter(f => !f.id);
        if (newFiles.length > 0) {
          await supabase.from("lesson_files").insert(
            newFiles.map((f, i) => ({
              lesson_id: lessonId,
              file_name: f.file_name,
              file_url: f.file_url,
              file_size: f.file_size,
              position: existingIds.length + i,
            }))
          );
        }

        toast.success("Aula atualizada!");
      } else {
        const moduleLessons = getLessonsForModule(lessonDialog.moduleId!);
        const { data: newLesson, error } = await supabase.from("lessons").insert({
          module_id: lessonDialog.moduleId!,
          title: lessonForm.title,
          description: lessonForm.description || null,
          video_url: lessonForm.video_url || null,
          content: lessonForm.content || null,
          duration_minutes: lessonForm.duration_minutes || 0,
          is_free: lessonForm.is_free,
          position: moduleLessons.length,
        }).select("id").single();
        if (error) {
          console.error("Lesson insert error:", error);
          throw error;
        }
        lessonId = newLesson.id;

        // Insert files
        if (lessonFiles.length > 0) {
          await supabase.from("lesson_files").insert(
            lessonFiles.map((f, i) => ({
              lesson_id: lessonId,
              file_name: f.file_name,
              file_url: f.file_url,
              file_size: f.file_size,
              position: i,
            }))
          );
        }

        toast.success("Aula criada!");
      }
      setLessonDialog({ open: false });
      queryClient.invalidateQueries({ queryKey: ["product-lessons"] });
    } catch (e: any) {
      console.error("Save lesson error:", e);
      toast.error(e.message || "Erro ao salvar aula");
    } finally {
      setSavingLesson(false);
    }
  };

  const deleteLesson = async (id: string) => {
    await supabase.from("lessons").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["product-lessons"] });
    toast.success("Aula excluída");
  };

  if (loadingModules) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Módulos & Aulas</h3>
          <p className="text-xs text-muted-foreground">
            Organize o conteúdo do seu curso em módulos e aulas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate(`/learn/${productId}?preview=true`)}
          >
            <Eye className="h-3.5 w-3.5" /> Visualizar
          </Button>
          <Button size="sm" onClick={openNewModule} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo Módulo
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <PlayCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhum módulo ainda</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Crie seu primeiro módulo para começar a adicionar aulas ao curso
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={openNewModule}>
              <Plus className="h-3.5 w-3.5" /> Criar Módulo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {modules.map((mod: any, idx: number) => {
            const lessons = getLessonsForModule(mod.id);
            return (
              <AccordionItem
                key={mod.id}
                value={mod.id}
                className="border border-border rounded-lg overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    {/* Module cover thumbnail */}
                    {(mod as any).cover_url ? (
                      <img
                        src={(mod as any).cover_url}
                        alt=""
                        className="h-12 w-9 rounded object-cover shrink-0 border border-border"
                      />
                    ) : (
                      <div className="h-12 w-9 rounded bg-muted flex items-center justify-center shrink-0 border border-border">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        Módulo {idx + 1}: {mod.title}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        {lessons.length} {lessons.length === 1 ? "aula" : "aulas"}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => openEditModule(mod)}
                    >
                      <Pencil className="h-3 w-3" /> Editar Módulo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                      onClick={() =>
                        setDeleteConfirm({
                          open: true,
                          type: "module",
                          id: mod.id,
                          title: mod.title,
                        })
                      }
                    >
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </div>

                  {/* Lessons list */}
                  <div className="space-y-1.5">
                    {lessons.map((lesson: any, lIdx: number) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-[0.6rem] font-bold shrink-0">
                          {lIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lesson.title}
                          </p>
                          <div className="flex items-center gap-2 text-[0.6rem] text-muted-foreground">
                            {lesson.video_url && (
                              <span className="flex items-center gap-0.5">
                                <Video className="h-2.5 w-2.5" /> Vídeo
                              </span>
                            )}
                            {lesson.content && (
                              <span className="flex items-center gap-0.5">
                                <FileText className="h-2.5 w-2.5" /> Texto
                              </span>
                            )}
                            {lesson.duration_minutes > 0 && (
                              <span>{lesson.duration_minutes}min</span>
                            )}
                            {lesson.is_free && (
                              <span className="text-green-500 font-semibold">
                                Gratuita
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditLesson(lesson)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() =>
                              setDeleteConfirm({
                                open: true,
                                type: "lesson",
                                id: lesson.id,
                                title: lesson.title,
                              })
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 gap-1 mt-1 border-dashed"
                      onClick={() => openNewLesson(mod.id)}
                    >
                      <Plus className="h-3 w-3" /> Adicionar Aula
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Module Dialog */}
      <Dialog
        open={moduleDialog.open}
        onOpenChange={(open) => !open && setModuleDialog({ open: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {moduleDialog.editing ? "Editar Módulo" : "Novo Módulo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome do módulo</Label>
              <Input
                value={moduleForm.title}
                onChange={(e) =>
                  setModuleForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Ex: Módulo 1 - Introdução"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) =>
                  setModuleForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                rows={2}
                className="mt-1"
                placeholder="Sobre o que esse módulo aborda..."
              />
            </div>
            <div>
              <Label className="text-xs">
                Capa do módulo (proporção vertical, estilo story)
              </Label>
              {moduleForm.cover_url ? (
                <div className="mt-1 relative inline-block">
                  <img
                    src={moduleForm.cover_url}
                    alt="Capa"
                    className="h-32 w-24 rounded-lg object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setModuleForm((f) => ({ ...f, cover_url: "" }))
                    }
                    className="absolute -top-1 -right-1 rounded-full bg-background border border-border p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors h-32 w-24">
                  {uploadingCover ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <span className="text-[0.6rem]">Enviar</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadCover(file);
                    }}
                  />
                </label>
              )}
              <p className="text-[0.6rem] text-muted-foreground mt-1">
                Recomendado: 600×900px (3:4)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={saveModule}
              disabled={savingModule}
              className="gap-1.5"
            >
              {savingModule && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {moduleDialog.editing ? "Salvar" : "Criar Módulo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog
        open={lessonDialog.open}
        onOpenChange={(open) => !open && setLessonDialog({ open: false })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lessonDialog.editing ? "Editar Aula" : "Nova Aula"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs">Nome da aula</Label>
              <Input
                value={lessonForm.title}
                onChange={(e) =>
                  setLessonForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Ex: Aula 1 - Bem-vindo"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                value={lessonForm.description}
                onChange={(e) =>
                  setLessonForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                rows={2}
                className="mt-1"
                placeholder="Breve descrição desta aula..."
              />
            </div>
            <div>
              <Label className="text-xs">Vídeo da aula</Label>
              <div className="mt-1 space-y-2">
                <Input
                  value={lessonForm.video_url}
                  onChange={(e) =>
                    setLessonForm((f) => ({ ...f, video_url: e.target.value }))
                  }
                  placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
                />
                {uploadingVideo ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Enviando... {uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[0.6rem] text-muted-foreground">ou</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-primary hover:underline">
                      <Upload className="h-3 w-3" />
                      Fazer upload de vídeo (até 500MB)
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadVideo(file);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              <p className="text-[0.6rem] text-muted-foreground mt-0.5">
                YouTube, Vimeo, link direto ou envie o arquivo
              </p>
            </div>
            <div>
              <Label className="text-xs">Conteúdo escrito (opcional)</Label>
              <Textarea
                value={lessonForm.content}
                onChange={(e) =>
                  setLessonForm((f) => ({ ...f, content: e.target.value }))
                }
                rows={4}
                className="mt-1"
                placeholder="Texto complementar, links, materiais..."
              />
            </div>

            {/* Material complementar */}
            <div>
              <Label className="text-xs">Material complementar (opcional)</Label>
              <p className="text-[0.6rem] text-muted-foreground mb-2">
                Arquivos para download que os alunos podem baixar nesta aula
              </p>

              {lessonFiles.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {lessonFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{file.file_name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {file.file_size > 0 ? `${(file.file_size / 1024 / 1024).toFixed(1)}MB` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLessonFile(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadingLessonFile ? (
                <div className="flex items-center gap-2 text-xs text-primary py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Enviando arquivo...</span>
                </div>
              ) : (
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-primary hover:underline">
                  <Upload className="h-3 w-3" />
                  Anexar arquivo
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLessonFile(file);
                    }}
                  />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Duração (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  value={lessonForm.duration_minutes}
                  onChange={(e) =>
                    setLessonForm((f) => ({
                      ...f,
                      duration_minutes: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={lessonForm.is_free}
                    onChange={(e) =>
                      setLessonForm((f) => ({
                        ...f,
                        is_free: e.target.checked,
                      }))
                    }
                    className="rounded border-border"
                  />
                  <span className="text-xs">Aula gratuita (prévia)</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={saveLesson}
              disabled={savingLesson}
              className="gap-1.5"
            >
              {savingLesson && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {lessonDialog.editing ? "Salvar" : "Criar Aula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteConfirm?.open}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {deleteConfirm?.type === "module" ? "módulo" : "aula"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteConfirm?.title}"?
              {deleteConfirm?.type === "module" &&
                " Todas as aulas deste módulo também serão excluídas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm?.type === "module") {
                  deleteModule(deleteConfirm.id);
                } else if (deleteConfirm) {
                  deleteLesson(deleteConfirm.id);
                }
                setDeleteConfirm(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
