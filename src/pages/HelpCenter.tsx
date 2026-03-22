import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, ChevronRight, ArrowLeft, HelpCircle,
  Rocket, Package, ShoppingBag, Landmark, Users, Plug, FileText, GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ICON_MAP: Record<string, React.ElementType> = {
  Rocket, Package, ShoppingBag, Landmark, Users, Plug, FileText, GraduationCap, HelpCircle,
};

type Category = { id: string; title: string; description: string | null; icon: string | null; position: number };
type Article = { id: string; category_id: string; title: string; content: string; position: number };

export default function HelpCenter() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["help-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("help_categories" as any)
        .select("*")
        .eq("is_active", true)
        .order("position");
      return (data || []) as unknown as Category[];
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["help-articles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("help_articles" as any)
        .select("*")
        .eq("is_active", true)
        .order("position");
      return (data || []) as Article[];
    },
  });

  const filteredArticles = search.trim()
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const categoryArticles = selectedCategory
    ? articles.filter((a) => a.category_id === selectedCategory.id)
    : [];

  // Article detail view
  if (selectedArticle) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedArticle(null)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">{selectedArticle.title}</h1>
          <div className="mt-6 prose prose-sm dark:prose-invert max-w-none">
            {selectedArticle.content.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-6 mb-3">{line.replace("## ", "")}</h2>;
              if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-2">{line.replace("### ", "")}</h3>;
              if (line.startsWith("> ")) return <blockquote key={i} className="border-l-2 border-primary pl-4 text-sm text-muted-foreground italic my-3">{line.replace("> ", "")}</blockquote>;
              if (line.startsWith("| ")) {
                const cells = line.split("|").filter(Boolean).map(c => c.trim());
                return <div key={i} className="flex gap-4 text-sm py-1">{cells.map((c, j) => <span key={j} className={j === 0 ? "font-medium min-w-[120px]" : "text-muted-foreground"}>{c}</span>)}</div>;
              }
              if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-sm ml-4 list-disc">{line.replace(/^[-*] /, "")}</li>;
              if (line.match(/^\d+\. /)) return <li key={i} className="text-sm ml-4 list-decimal">{line.replace(/^\d+\. /, "")}</li>;
              if (line.trim() === "") return <div key={i} className="h-2" />;
              return <p key={i} className="text-sm leading-relaxed">{renderBold(line)}</p>;
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // Category detail view
  if (selectedCategory) {
    const Icon = ICON_MAP[selectedCategory.icon || "HelpCircle"] || HelpCircle;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedCategory(null)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{selectedCategory.title}</h1>
              <p className="text-sm text-muted-foreground">{categoryArticles.length} artigos</p>
            </div>
          </div>
          {selectedCategory.description && (
            <p className="text-sm text-muted-foreground mb-4">{selectedCategory.description}</p>
          )}
          <div className="space-y-1">
            {categoryArticles.map((article) => (
              <button
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
              >
                <span className="text-sm">{article.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
            {categoryArticles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum artigo nesta categoria ainda.</p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Main view
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Ajuda</h1>
        <p className="text-sm text-muted-foreground mt-1">Pesquise artigos ou navegue pelas categorias abaixo.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por artigo..."
          className="pl-10 h-11 bg-muted/50 border-transparent focus:border-border"
        />
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {search.trim() && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              {filteredArticles.length} resultado{filteredArticles.length !== 1 ? "s" : ""} encontrado{filteredArticles.length !== 1 ? "s" : ""}
            </p>
            {filteredArticles.map((article) => {
              const cat = categories.find((c) => c.id === article.category_id);
              return (
                <button
                  key={article.id}
                  onClick={() => { setSelectedArticle(article); setSearch(""); }}
                  className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                >
                  <div>
                    <span className="text-sm font-medium">{article.title}</span>
                    {cat && <span className="text-xs text-muted-foreground ml-2">• {cat.title}</span>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
            {filteredArticles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum artigo encontrado.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Featured Articles */}
      {!search.trim() && articles.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-bold">Artigos em Destaque</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {articles.slice(0, 6).map((article) => (
              <button
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
              >
                <span className="text-sm truncate">{article.title}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {!search.trim() && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map((category) => {
            const Icon = ICON_MAP[category.icon || "HelpCircle"] || HelpCircle;
            const count = articles.filter((a) => a.category_id === category.id).length;
            return (
              <motion.button
                key={category.id}
                onClick={() => setSelectedCategory(category)}
                className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/30 transition-colors group space-y-3"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">{category.title}</h3>
                </div>
                {category.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{count} artigo{count !== 1 ? "s" : ""}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
