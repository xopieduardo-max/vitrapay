import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, ExternalLink } from "lucide-react";

interface Props {
  path: string;
  name?: string | null;
  type?: string | null;
  /** Tint the file card for own bubble vs received bubble. */
  ownBubble?: boolean;
}

export function SupportAttachment({ path, name, type, ownBubble }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = (type || "").startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.storage
        .from("support-attachments")
        .createSignedUrl(path, 60 * 60);
      if (!cancelled) {
        setUrl(data?.signedUrl ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs opacity-80 py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando anexo…
      </div>
    );
  }

  if (!url) {
    return <p className="text-xs opacity-70 italic">Anexo indisponível</p>;
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={url}
          alt={name || "anexo"}
          className="max-h-64 max-w-full rounded-lg object-contain bg-black/20"
          loading="lazy"
        />
      </a>
    );
  }

  // PDF / other
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs border transition hover:opacity-90 ${
        ownBubble
          ? "bg-white/10 border-white/20"
          : "bg-background/60 border-border"
      }`}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{name || "documento.pdf"}</span>
      <ExternalLink className="h-3 w-3 opacity-70" />
    </a>
  );
}
