// Gera um hash estável do dispositivo (sem ser fingerprint invasivo)
// Combina: user-agent + platform + idioma + timezone + screen
export async function getDeviceHash(): Promise<string> {
  const parts = [
    navigator.userAgent || "",
    navigator.platform || "",
    navigator.language || "",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
  ];
  const data = new TextEncoder().encode(parts.join("|"));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  let os = "Desconhecido";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Navegador";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  return `${browser} • ${os}`;
}

export async function getClientIp(): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch("https://api.ipify.org?format=json", { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    return j.ip || null;
  } catch {
    return null;
  }
}
