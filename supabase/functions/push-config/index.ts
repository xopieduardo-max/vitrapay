import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getPublicKey() {
  const decodeBase64Url = (value: string) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return Uint8Array.from(atob(normalized + padding), (char) => char.charCodeAt(0));
  };

  const candidates = [Deno.env.get("VAPID_PUB") || "", Deno.env.get("VAPID_PUBLIC_KEY") || ""];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    try {
      if (decodeBase64Url(trimmed).length === 65) return trimmed;
    } catch {
      continue;
    }
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const publicKey = getPublicKey();

    if (!publicKey) {
      return new Response(JSON.stringify({ error: "VAPID public key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ publicKey }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});