export type VapidKeyPair = {
  label: string;
  publicKey: string;
  privateKey: string;
};

export function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(normalized + padding), (char) => char.charCodeAt(0));
}

function isValidPublicKey(value: string) {
  try {
    return decodeBase64Url(value).length === 65;
  } catch {
    return false;
  }
}

function isValidPrivateKey(value: string) {
  try {
    return decodeBase64Url(value).length === 32;
  } catch {
    return false;
  }
}

export function getVapidKeyCandidates() {
  const rawCandidates: VapidKeyPair[] = [
    {
      label: "VAPID_PUB/VAPID_PRIV",
      publicKey: (Deno.env.get("VAPID_PUB") || "").trim(),
      privateKey: (Deno.env.get("VAPID_PRIV") || "").trim(),
    },
    {
      label: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY",
      publicKey: (Deno.env.get("VAPID_PUBLIC_KEY") || "").trim(),
      privateKey: (Deno.env.get("VAPID_PRIVATE_KEY") || "").trim(),
    },
  ];

  const uniqueCandidates = new Map<string, VapidKeyPair>();

  for (const candidate of rawCandidates) {
    if (!candidate.publicKey || !candidate.privateKey) continue;
    if (!isValidPublicKey(candidate.publicKey) || !isValidPrivateKey(candidate.privateKey)) continue;

    uniqueCandidates.set(`${candidate.publicKey}:${candidate.privateKey}`, candidate);
  }

  return Array.from(uniqueCandidates.values());
}

export function getPrimaryVapidKeyPair() {
  const candidates = getVapidKeyCandidates();

  if (candidates.length === 0) {
    throw new Error("VAPID keys not configured");
  }

  return candidates[0];
}