import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function UtmCapture() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const hasUtm = UTM_KEYS.some((k) => searchParams.get(k));
    if (!hasUtm) return;

    const data: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const val = searchParams.get(key);
      if (val) data[key] = val;
    }
    localStorage.setItem("utm_data", JSON.stringify(data));
  }, [searchParams]);

  return null;
}

export function getUtmData(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("utm_data") || "{}");
  } catch {
    return {};
  }
}
