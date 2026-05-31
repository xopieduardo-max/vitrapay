// Helpers para gerar arquivos de público personalizado compatíveis com
// Meta Ads (Custom Audiences) e Google Ads (Customer Match).
// Ambos exigem hash SHA-256 dos dados normalizados (email/telefone).

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const normalizeEmail = (v?: string | null) =>
  (v || "").trim().toLowerCase();

// E.164 — só dígitos. Adiciona 55 (BR) se vier sem código de país.
const normalizePhone = (v?: string | null) => {
  const digits = (v || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return "55" + digits;
  return digits;
};

const normalizeName = (v?: string | null) =>
  (v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const csvCell = (v: string) => {
  if (!v) return "";
  const s = v.replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

const download = (content: string, filename: string) => {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export interface AudienceContact {
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_city?: string | null;
  buyer_state?: string | null;
}

/**
 * Meta Ads — Custom Audience CSV.
 * Cabeçalhos oficiais: EMAIL_SHA256, PHONE_SHA256, FN, LN, CT, ST, COUNTRY.
 * Nome/cidade/estado também são hasheados (exigência da Meta).
 */
export async function exportMetaAudience(
  rows: AudienceContact[],
  filename: string
) {
  const header = ["EMAIL_SHA256", "PHONE_SHA256", "FN", "LN", "CT", "ST", "COUNTRY"];
  const lines = [header.join(",")];

  for (const r of rows) {
    const email = normalizeEmail(r.buyer_email);
    const phone = normalizePhone(r.buyer_phone);
    const [first = "", ...rest] = normalizeName(r.buyer_name).split(/\s+/);
    const last = rest.join(" ");
    const city = normalizeName(r.buyer_city);
    const state = normalizeName(r.buyer_state);

    const cells = [
      email ? await sha256Hex(email) : "",
      phone ? await sha256Hex(phone) : "",
      first ? await sha256Hex(first) : "",
      last ? await sha256Hex(last) : "",
      city ? await sha256Hex(city) : "",
      state ? await sha256Hex(state) : "",
      "br",
    ];
    lines.push(cells.map(csvCell).join(","));
  }

  download(lines.join("\n"), filename);
}

/**
 * Google Ads — Customer Match CSV.
 * Cabeçalhos: Email,Phone,First Name,Last Name,Country,Zip.
 * Email/Phone hasheados, nome/país em texto (padrão Google).
 */
export async function exportGoogleAudience(
  rows: AudienceContact[],
  filename: string
) {
  const header = ["Email", "Phone", "First Name", "Last Name", "Country", "Zip"];
  const lines = [header.join(",")];

  for (const r of rows) {
    const email = normalizeEmail(r.buyer_email);
    const phone = normalizePhone(r.buyer_phone);
    const [first = "", ...rest] = (r.buyer_name || "").trim().split(/\s+/);
    const last = rest.join(" ");

    const cells = [
      email ? await sha256Hex(email) : "",
      phone ? await sha256Hex("+" + phone) : "",
      first,
      last,
      "BR",
      "",
    ];
    lines.push(cells.map(csvCell).join(","));
  }

  download(lines.join("\n"), filename);
}
