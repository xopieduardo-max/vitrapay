/**
 * Simple rate limiting for checkout endpoints.
 * Uses pending_payments table as the store — no extra table needed.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Checks if a CPF has too many recent checkout attempts.
 * Limit: 5 attempts per 10 minutes per CPF.
 */
export async function checkCpfRateLimit(
  supabase: any,
  cpf: string,
): Promise<RateLimitResult> {
  const WINDOW_MINUTES = 10;
  const MAX_ATTEMPTS = 5;

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const cpfClean = cpf.replace(/\D/g, "");

  const { count } = await supabase
    .from("pending_payments")
    .select("id", { count: "exact", head: true })
    .eq("buyer_cpf", cpfClean)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
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
  const WINDOW_MINUTES = 5;
  const MAX_ATTEMPTS = 10;

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("pending_payments")
    .select("id", { count: "exact", head: true })
    .eq("buyer_ip", ip)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
  }

  return { allowed: true };
}
