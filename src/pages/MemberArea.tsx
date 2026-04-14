import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  Play, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, ArrowLeft, BookOpen, Layers, Download, Paperclip, Award,
} from "lucide-react";

type Module = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: Lesson[];
};

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  content: string | null;
  duration_minutes: number;
  position: number;
  is_free: boolean;
};

export default function MemberArea() {
  const { productId } = useParams<{ productId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const [product, setProduct] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"overview" | "lesson">("overview");
  const [lessonFiles, setLessonFiles] = useState<Record<string, { id: string; file_name: string; file_url: string }[]>>({});

  useEffect(() => {
    if (!productId || !user) return;
    loadContent();
  }, [productId, user]);

  const loadContent = async () => {
    // Verify access before loading content (producers bypass this check)
    if (!isPreview) {
      const { data: productCheck } = await supabase
        .from("products")
        .select("producer_id")
        .eq("id", productId!)
        .maybeSingle();

      const isProducer = productCheck?.producer_id === user?.id;

      if (!isProducer) {
        const { data: access } = await supabase
          .from("product_access")
          .select("id")
          .eq("product_id", productId!)
          .eq("user_id", user!.id)
          .maybeSingle();

        if (!access) {
          navigate("/minha-conta", { replace: true });
          return;
        }
      }
    }

    const { data: mods } = await supabase
      .from("modules")
      .select("*")
      .eq("product_id", productId!)
      .order("position");

    const moduleIds = (mods || []).map((m: any) => m.id);

    const [{ data: prod }, { data: lessonsData }, { data: prog }] = await Promise.all([
      supabase.from("products").select("*").eq("id", productId!).single(),
      moduleIds.length > 0
        ? supabase.from("lessons").select("*").in("module_id", moduleIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("user_id", user!.id),
    ]);

    if (prod) setProduct(prod);
    if (mods) {
      const lessonsByModule: Record<string, Lesson[]> = {};
      (lessonsData || []).forEach((l: any) => {
        if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
        lessonsByModule[l.module_id].push(l);
      });

      const sorted = mods.map((m: any) => ({
        ...m,
        lessons: (lessonsByModule[m.id] || []).sort((a: any, b: any) => a.position - b.position),
      }));
      setModules(sorted);
      if (sorted.length > 0) {
        setExpandedModules(new Set([sorted[0].id]));
      }
    }
    if (prog) {
      const map: Record<string, boolean> = {};
      prog.forEach((p: any) => { map[p.lesson_id] = p.completed; });
      setProgress(map);
    }
    setLoading(false);
  };

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markComplete = async (lessonId: string) => {
    if (!user) return;
    await supabase.from("lesson_progress").upsert({
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: "user_id,lesson_id" });
    setProgress((prev) => ({ ...prev, [lessonId]: true }));
  };

  const openLesson = async (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setView("lesson");
    // Fetch files if not already loaded
    if (!lessonFiles[lesson.id]) {
      const { data } = await supabase
        .from("lesson_files")
        .select("id, file_name, file_url")
        .eq("lesson_id", lesson.id)
        .order("position");
      setLessonFiles(prev => ({ ...prev, [lesson.id]: data || [] }));
    }
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const courseCompleted = totalLessons > 0 && completedLessons >= totalLessons;

  const downloadCertificate = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 850;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gold border
    ctx.strokeStyle = "#f5c518";
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);

    // VitraPay title
    ctx.fillStyle = "#f5c518";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VitraPay", canvas.width / 2, 110);

    // "Certificado de Conclusão"
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px Arial";
    ctx.fillText("Certificado de Conclusão", canvas.width / 2, 200);

    // Decorative line
    ctx.strokeStyle = "#f5c518";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 230);
    ctx.lineTo(canvas.width - 200, 230);
    ctx.stroke();

    // "Certificamos que"
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "24px Arial";
    ctx.fillText("Certificamos que", canvas.width / 2, 300);

    // Student name
    const studentName = user?.user_metadata?.display_name || user?.email || "Aluno";
    ctx.fillStyle = "#f5c518";
    ctx.font = "bold 48px Arial";
    ctx.fillText(studentName, canvas.width / 2, 380);

    // "concluiu com êxito o curso"
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "24px Arial";
    ctx.fillText("concluiu com êxito o curso", canvas.width / 2, 440);

    // Course name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Arial";
    const courseName = product?.title || "Curso";
    ctx.fillText(courseName, canvas.width / 2, 510);

    // Date
    ctx.fillStyle = "#888888";
    ctx.font = "20px Arial";
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    ctx.fillText(`Concluído em ${dateStr}`, canvas.width / 2, 590);

    // Bottom decorative line
    ctx.strokeStyle = "#f5c518";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 640);
    ctx.lineTo(canvas.width - 200, 640);
    ctx.stroke();

    // Footer
    ctx.fillStyle = "#666666";
    ctx.font = "16px Arial";
    ctx.fillText("vitrapay.com.br", canvas.width / 2, 690);

    // Download
    const link = document.createElement("a");
    link.download = `certificado-${(product?.title || "curso").replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const getModuleProgress = (mod: Module) => {
    const completed = mod.lessons.filter((l) => progress[l.id]).length;
    return { completed, total: mod.lessons.length, percent: mod.lessons.length > 0 ? (completed / mod.lessons.length) * 100 : 0 };
  };

  const getModuleDuration = (mod: Module) => {
    return mod.lessons.reduce((acc, l) => acc + (l.duration_minutes || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Netflix-style overview
  if (view === "overview") {
    return (
      <div className="min-h-screen bg-background">
        {/* Preview floating bar */}
        {isPreview && (
          <div className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm">
            <span className="font-medium">👁 Modo Preview — é assim que seus alunos verão o curso</span>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => navigate(`/products/${productId}/edit?tab=content`)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao editor
            </Button>
          </div>
        )}
        {/* Hero banner */}
        <div className="relative w-full overflow-hidden" style={{ minHeight: 280 }}>
          {product?.cover_url ? (
            <img
              src={product.cover_url}
              alt={product?.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="relative z-10 max-w-5xl mx-auto px-4 pt-6 pb-10 flex flex-col justify-end" style={{ minHeight: 280 }}>
            {!isPreview && (
              <Link to="/minha-conta" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 w-fit">
                <ArrowLeft className="h-3 w-3" /> Voltar
              </Link>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              {product?.title}
            </h1>
            {product?.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl line-clamp-3">
                {product.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                {modules.length} módulo{modules.length !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                {totalLessons} aula{totalLessons !== 1 ? "s" : ""}
              </div>
              <Badge variant="secondary" className="text-[0.65rem]">
                {Math.round(progressPercent)}% concluído
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-1.5 mt-3 max-w-md" />
            {courseCompleted && (
              <Button onClick={downloadCertificate} className="gap-2 mt-4 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold">
                <Award className="h-4 w-4" />
                Baixar Certificado
              </Button>
            )}
          </div>
        </div>

        {/* Module cards - Netflix style */}
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
          {modules.map((mod, idx) => {
            const modProgress = getModuleProgress(mod);
            const duration = getModuleDuration(mod);

            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.5, ease: [0.2, 0, 0, 1] }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold tracking-tight">{mod.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    {modProgress.completed}/{modProgress.total} aulas
                  </span>
                </div>
                {mod.description && (
                  <p className="text-xs text-muted-foreground mb-3 -mt-1">{mod.description}</p>
                )}

                {/* Horizontal scroll of lesson cards */}
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
                  {mod.lessons.map((lesson, li) => {
                    const isCompleted = progress[lesson.id];
                    return (
                      <motion.button
                        key={lesson.id}
                        onClick={() => openLesson(lesson)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative flex-shrink-0 w-48 sm:w-56 rounded-xl overflow-hidden border border-border bg-card hover:border-primary/40 transition-colors snap-start group text-left"
                      >
                        <div className="aspect-video w-full bg-muted/30 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
                          <div className="relative z-10 flex flex-col items-center gap-1">
                            {isCompleted ? (
                              <CheckCircle2 className="h-8 w-8 text-primary" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                                <Play className="h-5 w-5 text-primary ml-0.5" />
                              </div>
                            )}
                          </div>
                          {/* Lesson number badge */}
                          <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[0.55rem] font-bold px-1.5 py-0.5 rounded">
                            Aula {li + 1}
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <p className="text-xs font-semibold line-clamp-2 leading-tight">{lesson.title}</p>
                          {lesson.duration_minutes > 0 && (
                            <div className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {lesson.duration_minutes} min
                            </div>
                          )}
                        </div>
                        {isCompleted && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Lesson view (existing layout)
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 xl:w-96 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <button
            onClick={() => setView("overview")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao curso
          </button>
          <h2 className="font-bold text-sm tracking-title line-clamp-1">{product?.title}</h2>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedLessons} de {totalLessons} aulas</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {modules.map((mod) => (
              <div key={mod.id} className="mb-1">
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  {expandedModules.has(mod.id) ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium flex-1">{mod.title}</span>
                  <Badge variant="secondary" className="text-[0.6rem]">
                    {mod.lessons.filter((l) => progress[l.id]).length}/{mod.lessons.length}
                  </Badge>
                </button>

                {expandedModules.has(mod.id) && (
                  <div className="ml-4 space-y-0.5">
                    {mod.lessons.map((lesson) => {
                      const isCompleted = progress[lesson.id];
                      const isActive = selectedLesson?.id === lesson.id;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => setSelectedLesson(lesson)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left text-sm ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Play className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="flex-1 truncate">{lesson.title}</span>
                          {lesson.duration_minutes > 0 && (
                            <span className="text-[0.6rem] text-muted-foreground shrink-0">
                              {lesson.duration_minutes}min
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedLesson ? (
          <motion.div
            key={selectedLesson.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            {/* Video player */}
            {selectedLesson.video_url ? (
              <div className="w-full aspect-video bg-black">
                <iframe
                  src={selectedLesson.video_url}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : (
              <div className="w-full aspect-video bg-muted/20 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Nenhum vídeo disponível</p>
              </div>
            )}

            {/* Lesson info */}
            <div className="p-6 space-y-4 max-w-3xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-title">{selectedLesson.title}</h1>
                  {selectedLesson.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedLesson.description}</p>
                  )}
                </div>
                <Button
                  variant={progress[selectedLesson.id] ? "secondary" : "default"}
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => markComplete(selectedLesson.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {progress[selectedLesson.id] ? "Concluída" : "Marcar como concluída"}
                </Button>
              </div>

              {selectedLesson.content && (
                <>
                  <Separator />
                  <div className="prose prose-sm prose-invert max-w-none">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedLesson.content}
                    </p>
                  </div>
                </>
              )}

              {/* Downloadable materials */}
              {lessonFiles[selectedLesson.id]?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                      <Paperclip className="h-4 w-4" />
                      Material complementar
                    </h3>
                    <div className="space-y-2">
                      {lessonFiles[selectedLesson.id].map((file) => (
                        <a
                          key={file.id}
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors group"
                        >
                          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Download className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm flex-1 truncate">{file.file_name}</span>
                          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                            Baixar
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Selecione uma aula para começar</p>
          </div>
        )}
      </main>
    </div>
  );
}
