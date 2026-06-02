import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches a short-lived signed URL for a product file (private bucket).
 * Caller must be the producer, an admin, or a buyer with product_access.
 * Returns null on failure.
 */
export async function getProductFileSignedUrl(fileId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("get-product-file-url", {
      body: { file_id: fileId },
    });
    if (error) {
      console.error("[getProductFileSignedUrl] error", error);
      return null;
    }
    return (data as any)?.url ?? null;
  } catch (e) {
    console.error("[getProductFileSignedUrl] exception", e);
    return null;
  }
}

/**
 * Opens a signed URL in a new tab (or triggers a download).
 */
export async function downloadProductFile(fileId: string, fileName?: string): Promise<boolean> {
  const url = await getProductFileSignedUrl(fileId);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  if (fileName) a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
