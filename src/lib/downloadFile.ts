/**
 * Downloads a file using fetch + blob to handle cross-origin URLs
 * where the `download` attribute on <a> tags is ignored.
 */
export async function downloadFile(url: string, filename?: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || url.split("/").pop() || "arquivo";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
}
