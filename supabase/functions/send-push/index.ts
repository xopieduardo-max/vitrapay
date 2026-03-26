import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { getVapidKeyCandidates } from "../_shared/push-vapid.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getPushErrorReason(errorBody: unknown) {
  if (typeof errorBody !== "string") return null;

  try {
    const parsed = JSON.parse(errorBody);
    return typeof parsed?.reason === "string" ? parsed.reason : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidCandidates = getVapidKeyCandidates();

    if (vapidCandidates.length === 0) {
      throw new Error("VAPID keys not configured");
    }

    const { producer_id, broadcast, title, body, url } = await req.json();

    if (!producer_id && !broadcast) {
      return new Response(JSON.stringify({ error: "producer_id or broadcast required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let subscriptions: any[] = [];

    if (broadcast) {
      // Send to ALL subscribed users
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("*");
      if (error) throw error;
      subscriptions = data || [];
    } else {
      // Send to a specific user
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", producer_id);
      if (error) throw error;
      subscriptions = data || [];
    }

    if (subscriptions.length === 0) {
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
      badge: "/badge-icon.png",
    });

    let sent = 0;
    let invalidated = 0;
    let mismatched = 0;

    for (const sub of subscriptions) {
      let delivered = false;
      let lastError: any = null;
      let lastReason: string | null = null;

      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        for (const vapid of vapidCandidates) {
          try {
            webpush.setVapidDetails("mailto:noreply@vitrapay.com.br", vapid.publicKey, vapid.privateKey);
            await webpush.sendNotification(pushSubscription, payload, {
              TTL: 86400,
            });

            sent++;
            delivered = true;
            console.log(`Push sent via ${vapid.label} to:`, sub.endpoint.slice(0, 60));
            break;
          } catch (e: any) {
            lastError = e;
            lastReason = getPushErrorReason(e.body);
            console.error(`Push send error via ${vapid.label}:`, e.statusCode, e.body);
          }
        }

        if (delivered) continue;

        if (lastError?.statusCode === 410 || lastError?.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          invalidated++;
          console.log("Removed expired subscription:", sub.id);
        } else if (lastReason === "VapidPkHashMismatch") {
          mismatched++;
          console.warn("Subscription kept due to VAPID mismatch, waiting for re-subscription:", sub.id);
        }
      } catch (e: any) {
        console.error("Unexpected push processing error:", e?.message || e);
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length, invalidated, mismatched }), {
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
