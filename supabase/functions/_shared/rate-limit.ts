/**
 * Rate limiting for checkout endpoints.
 * Uses pending_payments table as the store — no extra table needed.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
}

/**
 * Checks if a CPF has too many recent checkout attempts.
 * Limit: 5 attempts per 10 minutes per CPF.
 */
export async function checkCpfRateLimit(
  supabase: any,
  cpf: string,
): Promise<RateLimitResult> {
  if (!cpf) return { allowed: true };
  const WINDOW_MINUTES = 10;
  const MAX_ATTEMPTS = 5;

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const cpfClean = cpf.replace(/\D/g, "");
  if (!cpfClean) return { allowed: true };

  const { count } = await supabase
    .from("pending_payments")
    .select("id", { count: "exact", head: true })
    .eq("buyer_cpf", cpfClean)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60, reason: "cpf_rate_limit" };
  }

  return { allowed: true };
}

/**
 * Extracts the client IP from request headers (Supabase edge runs behind a proxy).
 */
export function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

/**
 * Checks if an IP has too many recent checkout attempts.
 * Limit: 10 attempts per 5 minutes per IP.
 */
export async function checkIpRateLimit(
  supabase: any,
  ip: string,
): Promise<RateLimitResult> {
  if (!ip) return { allowed: true };
  const WINDOW_MINUTES = 5;
  const MAX_ATTEMPTS = 10;

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("pending_payments")
    .select("id", { count: "exact", head: true })
    .eq("buyer_ip", ip)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60, reason: "ip_rate_limit" };
  }

  return { allowed: true };
}

/**
 * Detects card testing pattern: same IP trying many different CPFs in a short window.
 * Strong signal of carding/fraud attack.
 * Limit: 4 distinct CPFs per 15 minutes per IP.
 */
export async function checkCardTestingPattern(
  supabase: any,
  ip: string,
  currentCpf: string,
): Promise<RateLimitResult> {
  if (!ip) return { allowed: true };
  const WINDOW_MINUTES = 15;
  const MAX_DISTINCT_CPFS = 4;

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("pending_payments")
    .select("buyer_cpf")
    .eq("buyer_ip", ip)
    .gte("created_at", windowStart)
    .limit(50);

  if (!data) return { allowed: true };

  const distinctCpfs = new Set<string>();
  if (currentCpf) {
    const c = currentCpf.replace(/\D/g, "");
    if (c) distinctCpfs.add(c);
  }
  for (const row of data) {
    if (row.buyer_cpf) {
      const c = String(row.buyer_cpf).replace(/\D/g, "");
      if (c) distinctCpfs.add(c);
    }
  }

  if (distinctCpfs.size > MAX_DISTINCT_CPFS) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60, reason: "card_testing_pattern" };
  }

  return { allowed: true };
}
