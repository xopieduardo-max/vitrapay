/**
 * Converts any browser-decodable image File to WebP for lighter uploads.
 * - Skips non-images and GIFs (animation would be lost).
 * - Falls back to the original file if conversion fails or doesn't shrink.
 */
export async function convertImageToWebp(
  file: File,
  opts: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.85 } = opts;
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  if (file.type === "image/webp" && file.size < 400 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file).catch(() => null);
    let width: number, height: number;
    let draw: (ctx: CanvasRenderingContext2D) => void;

    if (bitmap) {
      width = bitmap.width;
      height = bitmap.height;
      draw = (ctx) => ctx.drawImage(bitmap, 0, 0, width, height);
    } else {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const url = URL.createObjectURL(file);
        const i = new Image();
        i.onload = () => { URL.revokeObjectURL(url); res(i); };
        i.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); };
        i.src = url;
      });
      width = img.naturalWidth; height = img.naturalHeight;
      draw = (ctx) => ctx.drawImage(img, 0, 0, width, height);
    }

    const ratio = Math.min(1, maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    draw(ctx);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", quality)
    );
    if (!blob) return file;
    if (blob.size >= file.size && file.type === "image/webp") return file;

    const baseName = (file.name || "imagem").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Pulls the first image (if any) out of a clipboard paste event. */
export function getImageFromClipboard(e: ClipboardEvent | React.ClipboardEvent): File | null {
  const items = (e as any).clipboardData?.items as DataTransferItemList | undefined;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) {
        const ext = f.type.split("/")[1] || "png";
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        return new File([f], `colado-${stamp}.${ext}`, { type: f.type });
      }
    }
  }
  return null;
}
