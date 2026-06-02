import { useEffect, useState } from "react";
import { getProductFileSignedUrl } from "@/lib/productFiles";

type FileLike = { id: string };

/**
 * Resolves short-lived signed URLs for a list of product files.
 * Refreshes every 4 minutes (TTL is 5 minutes server-side).
 * Returns a map of fileId -> signed URL.
 */
export function useSignedProductFileUrls(files: FileLike[] | undefined | null) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (!files || files.length === 0) {
      setUrls({});
      return;
    }

    const load = async () => {
      const entries = await Promise.all(
        files.map(async (f) => {
          const url = await getProductFileSignedUrl(f.id);
          return [f.id, url] as const;
        }),
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        if (url) map[id] = url;
      });
      setUrls(map);
    };

    load();
    const t = setInterval(load, 4 * 60 * 1000); // refresh every 4 min
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [JSON.stringify((files || []).map((f) => f.id))]);

  return urls;
}
