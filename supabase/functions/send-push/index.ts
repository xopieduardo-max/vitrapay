import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function initVapid() {
  const pub = (Deno.env.get("VAPID_PUB") || Deno.env.get("VAPID_PUBLIC_KEY") || "").trim();
  const priv = (Deno.env.get("VAPID_PRIV") || Deno.env.get("VAPID_PRIVATE_KEY") || "").trim();
  console.log("VAPID pub length:", pub.length, "first 10:", pub.slice(0, 10));
  if (!pub || !priv) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails("mailto:noreply@vitrapay.com.br", pub, priv);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    initVapid();

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

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
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
