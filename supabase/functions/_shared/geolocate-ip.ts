/**
 * Geolocate an IP address using ip-api.com (free, no key required).
 * Returns { city, state, country } or nulls on failure.
 * Rate limit: 45 req/min — sufficient for checkout flow.
 */
export async function geolocateIp(
  req: Request
): Promise<{ city: string | null; state: string | null; country: string | null }> {
  const empty = { city: null, state: null, country: null };

  try {
    // Extract client IP from headers (Deno Deploy / Supabase Edge)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      null;

    if (!ip || ip === "127.0.0.1" || ip === "::1") {
      console.log("Geolocation: no valid IP found");
      return empty;
    }

    console.log("Geolocation: looking up IP", ip.slice(0, 8) + "***");

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city&lang=pt`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!res.ok) {
      console.warn("Geolocation: API returned", res.status);
      return empty;
    }

    const data = await res.json();

    if (data.status !== "success") {
      console.warn("Geolocation: lookup failed for IP");
      return empty;
    }

    const result = {
      city: data.city || null,
      state: data.regionName || null,
      country: data.country || null,
    };

    console.log("Geolocation result:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn("Geolocation error (non-critical):", err);
    return empty;
  }
}
