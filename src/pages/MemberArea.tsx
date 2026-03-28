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
  Play, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, ArrowLeft, BookOpen, Layers,
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

  useEffect(() => {
    if (!productId || !user) return;
    loadContent();
  }, [productId, user]);

  const loadContent = async () => {
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

  const openLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setView("lesson");
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

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
