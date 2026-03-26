import { supabase } from "@/integrations/supabase/client";

let cachedPushPublicKey: string | null = null;

export async function getPushPublicKey() {
  if (cachedPushPublicKey) return cachedPushPublicKey;

  const { data, error } = await supabase.functions.invoke("push-config", {
    body: {},
  });

  if (error) {
    throw new Error("Não foi possível carregar a chave pública das notificações.");
  }

  const publicKey = typeof data?.publicKey === "string" ? data.publicKey.trim() : "";

  if (!publicKey) {
    throw new Error("Chave pública das notificações indisponível.");
  }

  cachedPushPublicKey = publicKey;
  return cachedPushPublicKey;
}

export function clearPushPublicKeyCache() {
  cachedPushPublicKey = null;
}