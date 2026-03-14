import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  Play, CheckCircle2, ChevronDown, ChevronRight, Lock, Clock, Loader2, ArrowLeft,
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

  const [product, setProduct] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId || !user) return;
    loadContent();
  }, [productId, user]);

  const loadContent = async () => {
    const [{ data: prod }, { data: mods }, { data: prog }] = await Promise.all([
      supabase.from("products").select("*").eq("id", productId!).single(),
      supabase
        .from("modules")
        .select("*, lessons(*)")
        .eq("product_id", productId!)
        .order("position"),
      supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("user_id", user!.id),
    ]);

    if (prod) setProduct(prod);
    if (mods) {
      const sorted = mods.map((m: any) => ({
        ...m,
        lessons: (m.lessons || []).sort((a: any, b: any) => a.position - b.position),
      }));
      setModules(sorted);
      // Auto-expand first module and select first lesson
      if (sorted.length > 0) {
        setExpandedModules(new Set([sorted[0].id]));
        if (sorted[0].lessons.length > 0 && !selectedLesson) {
          setSelectedLesson(sorted[0].lessons[0]);
        }
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

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = Object.values(progress).filter(Boolean).length;
  const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 xl:w-96 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <Link to="/library" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-3 w-3" /> Voltar à biblioteca
          </Link>
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
