const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.warn("Legacy process-purchase called and blocked");

  return new Response(
    JSON.stringify({
      error: "Fluxo de compra legado desativado por segurança. Atualize a página e tente novamente.",
      code: "LEGACY_CHECKOUT_DISABLED",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
