import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending pushes where scheduled_at <= now
    const { data: pending, error: fetchErr } = await supabase
      .from("scheduled_fake_pushes")
      .select("*")
      .is("sent_at", null)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const push of pending) {
      try {
        // Call send-push edge function internally
        const pushUrl = `${supabaseUrl}/functions/v1/send-push`;
        const res = await fetch(pushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            producer_id: push.producer_id,
            title: push.title,
            body: push.body,
            url: push.url || "/sales",
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          console.error(`Push send failed for ${push.id}:`, await res.text());
        }

        // Mark as sent regardless to avoid infinite retries
        await supabase
          .from("scheduled_fake_pushes")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", push.id);
      } catch (e) {
        console.error(`Error processing push ${push.id}:`, e);
        // Mark as sent to prevent stuck records
        await supabase
          .from("scheduled_fake_pushes")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", push.id);
      }
    }

    console.log(`Processed ${sent}/${pending.length} scheduled pushes`);

    return new Response(JSON.stringify({ processed: sent, total: pending.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("process-scheduled-pushes error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
