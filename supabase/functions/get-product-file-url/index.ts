// Generates a short-lived signed URL for a product file in the private
// `product-files` bucket, but ONLY for users that legitimately have access:
//   - the product's producer
//   - a buyer with a row in `product_access` (matched by user_id or email)
//   - any admin
//
// Input: { file_id: string }  (uuid of product_files row)
// Output: { url: string, expires_in: number }
//
// CORS enabled. Validates JWT in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Extracts {bucket, path} from either a full URL or a raw path.
// Defaults to the new private deliverables bucket. Falls back to legacy product-files
// for files uploaded before the bucket split.
function extractBucketAndPath(fileUrl: string): { bucket: string; path: string } | null {
  if (!fileUrl) return null;
  const buckets = ["product-deliverables", "product-files"];
  if (!fileUrl.startsWith("http")) {
    return { bucket: "product-deliverables", path: fileUrl.replace(/^\/+/, "") };
  }
  for (const b of buckets) {
    for (const m of [`/object/public/${b}/`, `/object/sign/${b}/`, `/object/${b}/`]) {
      const idx = fileUrl.indexOf(m);
      if (idx !== -1) {
        const tail = fileUrl.slice(idx + m.length).split("?")[0];
        return { bucket: b, path: tail };
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "missing_token" }, 401);

  // Identify the caller
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "invalid_token" }, 401);
  }
  const user = userData.user;

  let body: { file_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const fileId = body.file_id;
  if (!fileId || typeof fileId !== "string") {
    return jsonResponse({ error: "missing_file_id" }, 400);
  }

  // Service role for cross-RLS lookups
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Load the file + product
  const { data: file, error: fileErr } = await admin
    .from("product_files")
    .select("id, product_id, file_url, file_name")
    .eq("id", fileId)
    .maybeSingle();

  if (fileErr || !file) {
    return jsonResponse({ error: "file_not_found" }, 404);
  }

  const { data: product } = await admin
    .from("products")
    .select("id, producer_id")
    .eq("id", file.product_id)
    .maybeSingle();

  if (!product) return jsonResponse({ error: "product_not_found" }, 404);

  // 2) Authorize
  let allowed = false;

  // 2a) Producer
  if (product.producer_id === user.id) allowed = true;

  // 2b) Admin
  if (!allowed) {
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (isAdmin === true) allowed = true;
  }

  // 2c) Buyer with product_access (user_id or email match)
  if (!allowed) {
    const { data: accessRows } = await admin
      .from("product_access")
      .select("id")
      .eq("product_id", product.id)
      .or(`user_id.eq.${user.id},buyer_email.eq.${user.email}`)
      .limit(1);
    if (accessRows && accessRows.length > 0) allowed = true;
  }

  if (!allowed) return jsonResponse({ error: "forbidden" }, 403);

  // 3) Sign URL
  const path = extractObjectPath(file.file_url);
  if (!path) return jsonResponse({ error: "invalid_file_path" }, 400);

  const { data: signed, error: signErr } = await admin.storage
    .from("product-files")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
      download: file.file_name || undefined,
    });

  if (signErr || !signed?.signedUrl) {
    return jsonResponse(
      { error: "sign_failed", detail: signErr?.message },
      500,
    );
  }

  return jsonResponse({
    url: signed.signedUrl,
    expires_in: SIGNED_URL_TTL_SECONDS,
  });
});
