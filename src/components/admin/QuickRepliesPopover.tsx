import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap } from "lucide-react";
import { Link } from "react-router-dom";

interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  body: string;
}

interface Props {
  query: string;
  open: boolean;
  onSelect: (body: string) => void;
  onClose: () => void;
}

export function QuickRepliesPopover({ query, open, onSelect, onClose }: Props) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["active-quick-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_quick_replies")
        .select("id, title, shortcut, body")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as QuickReply[];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.shortcut?.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => { setActive(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, Math.max(0, filtered.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[active].body);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[active].body);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, filtered, active, onSelect, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-30 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground border-b border-border flex items-center justify-between">
        <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Respostas rápidas</span>
        <span className="text-muted-foreground/70 normal-case tracking-normal">↑↓ navegar · Enter inserir · Esc fechar</span>
      </div>
      {filtered.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground text-center">
          {items.length === 0 ? (
            <>Nenhuma resposta cadastrada. <Link to="/admin/quick-replies" className="text-primary hover:underline">Criar agora</Link>.</>
          ) : (
            <>Nenhum resultado para "{query}".</>
          )}
        </div>
      ) : (
        <div ref={listRef} className="max-h-64 overflow-y-auto">
          {filtered.map((q, i) => (
            <button
              key={q.id}
              type="button"
              data-idx={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => onSelect(q.body)}
              className={`w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 border-b border-border/50 last:border-b-0 transition-colors ${
                i === active ? "bg-primary/10" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{q.title}</span>
                {q.shortcut && (
                  <code className="text-[0.6rem] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    /{q.shortcut}
                  </code>
                )}
              </div>
              <span className="text-xs text-muted-foreground line-clamp-1 whitespace-pre-wrap">{q.body}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
