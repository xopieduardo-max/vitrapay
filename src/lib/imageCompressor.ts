/**
 * Client-side image compressor for checkout banners.
 * Resizes and compresses images to max 1200px wide, JPEG quality 0.82.
 * Target: < 150KB for fast checkout loading.
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: string;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1200,
    maxHeight = 800,
    quality = 0.82,
    type = "image/webp",
  } = options;

  // Skip if already small enough (< 100KB)
  if (file.size < 100 * 1024) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression didn't help, return original
            resolve(file);
            return;
          }

          const ext = type === "image/webp" ? "webp" : "jpg";
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, `.${ext}`),
            { type }
          );

          console.log(
            `[ImageCompressor] ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`
          );

          resolve(compressedFile);
        },
        type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
