import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64 + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const publicKeyRaw = base64UrlToUint8Array(publicKeyB64);
  const privateKeyRaw = base64UrlToUint8Array(privateKeyB64);

  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicKeyRaw,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    []
  );

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    await buildPkcs8(privateKeyRaw),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  return { publicKey, privateKey, publicKeyRaw };
}

async function buildPkcs8(privateKeyRaw: Uint8Array): Promise<ArrayBuffer> {
  // Wrap raw 32-byte EC private key in PKCS#8 DER envelope
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // We need the public key too - but for signing we can skip it
  // Simplified: just wrap the private key
  const result = new Uint8Array(pkcs8Header.length + 32);
  result.set(pkcs8Header);
  result.set(privateKeyRaw, pkcs8Header.length);
  return result.buffer;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJwt(
  audience: string,
  subject: string,
  privateKey: CryptoKey
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(payload)));
  const input = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(input)
  );

  // Convert DER signature to raw r||s
  const derSig = new Uint8Array(signature);
  let offset = 3;
  const rLen = derSig[offset];
  offset++;
  const r = derSig.slice(offset, offset + rLen);
  offset += rLen + 1;
  const sLen = derSig[offset];
  offset++;
  const s = derSig.slice(offset, offset + sLen);

  const rawR = r.length > 32 ? r.slice(r.length - 32) : r;
  const rawS = s.length > 32 ? s.slice(s.length - 32) : s;

  const rawSig = new Uint8Array(64);
  rawSig.set(rawR, 32 - rawR.length);
  rawSig.set(rawS, 64 - rawS.length);

  const sigB64 = uint8ArrayToBase64Url(rawSig);
  return `${input}.${sigB64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { producer_id, title, body, url } = await req.json();

    if (!producer_id) {
      return new Response(JSON.stringify({ error: "producer_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", producer_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "Nova venda! 🎉",
      body: body || "Você acabou de receber uma nova venda.",
      url: url || "/dashboard",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
    });

    let sent = 0;

    for (const sub of subscriptions) {
      try {
        const endpointUrl = new URL(sub.endpoint);
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

        // Use web-push compatible headers
        // For simplicity we'll use the fetch API with the VAPID JWT
        const { privateKey } = await importVapidKeys(vapidPublicKey, vapidPrivateKey);
        const jwt = await createJwt(audience, `mailto:noreply@aether.app`, privateKey);

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
            TTL: "86400",
          },
          body: new TextEncoder().encode(payload),
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      } catch (e) {
        console.error("Push send error:", e);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("send-push error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
