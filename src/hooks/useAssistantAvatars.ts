import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves storage paths in the `support-assistants` bucket into signed URLs.
 * Accepts both raw paths and already-resolved http(s) URLs (returned as-is).
 */
export function useAssistantAvatars(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(paths.filter(Boolean) as string[]));
    if (unique.length === 0) {
      setUrls({});
      return;
    }
    const toSign = unique.filter((p) => !/^https?:\/\//.test(p));
    const passthrough: Record<string, string> = {};
    unique.forEach((p) => {
      if (/^https?:\/\//.test(p)) passthrough[p] = p;
    });

    (async () => {
      if (toSign.length === 0) {
        if (!cancelled) setUrls(passthrough);
        return;
      }
      const { data } = await supabase.storage
        .from("support-assistants")
        .createSignedUrls(toSign, 60 * 60 * 6);
      if (cancelled) return;
      const map: Record<string, string> = { ...passthrough };
      (data || []).forEach((d) => {
        if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      });
      setUrls(map);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
