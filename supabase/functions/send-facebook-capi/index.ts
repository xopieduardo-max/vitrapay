import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SHA-256 hash for user data (Facebook CAPI requirement)
async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface CAPIPayload {
  product_id: string;
  payment_id: string;
  amount: number;
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_cpf: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: CAPIPayload = await req.json();
    const { product_id, payment_id, amount, buyer_email, buyer_name, buyer_phone, buyer_cpf } = payload;

    if (!product_id || !payment_id) {
      console.error("CAPI: Missing product_id or payment_id");
      return new Response(JSON.stringify({ status: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get active Facebook pixels with access_token for this product
    const { data: pixels, error: pixErr } = await supabase
      .from("product_pixels")
      .select("pixel_id, access_token, config")
      .eq("product_id", product_id)
      .eq("platform", "facebook")
      .eq("is_active", true);

    if (pixErr || !pixels || pixels.length === 0) {
      console.log("CAPI: No active Facebook pixels found for product:", product_id);
      return new Response(JSON.stringify({ status: "no_pixels" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user_data with SHA-256 hashed values
    const userData: Record<string, string | string[]> = {};

    if (buyer_email) {
      userData.em = [await sha256(buyer_email)];
    }
    if (buyer_phone) {
      // Normalize phone: remove non-digits, add country code if missing
      let phone = buyer_phone.replace(/\D/g, "");
      if (!phone.startsWith("55")) phone = "55" + phone;
      userData.ph = [await sha256(phone)];
    }
    if (buyer_name) {
      const parts = buyer_name.trim().split(/\s+/);
      if (parts.length > 0) {
        userData.fn = [await sha256(parts[0])];
      }
      if (parts.length > 1) {
        userData.ln = [await sha256(parts[parts.length - 1])];
      }
    }

    // Country always BR
    userData.country = [await sha256("br")];

    const eventTime = Math.floor(Date.now() / 1000);
    const results: { pixel_id: string; status: number; response: string }[] = [];

    for (const px of pixels) {
      if (!px.access_token) {
        console.log("CAPI: Pixel", px.pixel_id, "has no access_token, skipping");
        continue;
      }

      const eventData = {
        data: [
          {
            event_name: "Purchase",
            event_time: eventTime,
            event_id: payment_id, // Deduplication with frontend pixel
            action_source: "website",
            user_data: userData,
            custom_data: {
              currency: "BRL",
              value: amount / 100, // Convert from cents
              content_type: "product",
              content_ids: [product_id],
            },
          },
        ],
      };

      console.log("CAPI: Sending Purchase event to pixel:", px.pixel_id, "event_id:", payment_id, "value:", amount / 100);

      try {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/${px.pixel_id}/events?access_token=${px.access_token}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(eventData),
          }
        );

        const resText = await res.text();
        console.log("CAPI: Response for pixel", px.pixel_id, ":", res.status, resText);

        results.push({
          pixel_id: px.pixel_id,
          status: res.status,
          response: resText,
        });
      } catch (fetchErr) {
        console.error("CAPI: Fetch error for pixel", px.pixel_id, ":", fetchErr);
        results.push({
          pixel_id: px.pixel_id,
          status: 500,
          response: String(fetchErr),
        });
      }
    }

    return new Response(JSON.stringify({ status: "ok", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("CAPI: Error:", err);
    return new Response(JSON.stringify({ status: "error", message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
