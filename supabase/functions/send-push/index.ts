import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// VAPID keys for push notifications
const VAPID_PUBLIC_KEY = "BMl6o6EhTPzsw80f47Dxs3_GqfrtFV0L8dHuhKTpiqfc_RL7cMbt0ahYuMwBesOIYPieW-UCihniGf7hJ-_iOvQ";
const VAPID_PRIVATE_KEY = "oEmxqbA2jtWLOsrXbOhHiKtpS_bAyakweV9HjA_zfsY";

webpush.setVapidDetails(
  "mailto:noreply@aetherpay.lovable.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

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
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload, {
          TTL: 86400,
        });
        sent++;
        console.log("Push sent to:", sub.endpoint.slice(0, 60));
      } catch (e: any) {
        console.error("Push send error:", e.statusCode, e.body);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          console.log("Removed expired subscription:", sub.id);
        }
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
