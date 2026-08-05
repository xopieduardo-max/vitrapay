/**
 * Allowed MIME types for each upload context.
 * This is the client-side guard. Supabase Storage also enforces bucket policies.
 */

export const ALLOWED_PRODUCT_FILES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/json",
  "text/json",
  "application/xml",
  "text/xml",
  "application/rtf",
  "text/markdown",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Video
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/gzip",
  // Ebooks
  "application/epub+zip",
]);

export const ALLOWED_IMAGE_FILES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export const ALLOWED_CHECKOUT_IMAGES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

export type FileContext = "product" | "cover" | "avatar" | "checkout" | "lesson";

function getAllowedSet(context: FileContext): Set<string> {
  switch (context) {
    case "product":
    case "lesson":
      return ALLOWED_PRODUCT_FILES;
    case "cover":
    case "avatar":
      return ALLOWED_IMAGE_FILES;
    case "checkout":
      return ALLOWED_CHECKOUT_IMAGES;
  }
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// Some browsers report an empty or generic MIME type (e.g. .json, .csv, .md).
// Fall back to the extension for these safe text/data formats.
const ALLOWED_EXTENSIONS_FALLBACK: Record<FileContext, string[]> = {
  product: ["json", "csv", "txt", "md", "xml", "rtf", "epub"],
  lesson: ["json", "csv", "txt", "md", "xml", "rtf", "epub"],
  cover: [],
  avatar: [],
  checkout: [],
};

export function validateFile(file: File, context: FileContext, maxMB = 20): FileValidationResult {
  const allowed = getAllowedSet(context);
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  const okByExt = ALLOWED_EXTENSIONS_FALLBACK[context].includes(ext);

  if (!allowed.has(file.type) && !okByExt) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido (.${ext.toUpperCase() || "desconhecido"}). Envie documentos, imagens, vídeos, áudios, arquivos de dados (JSON, CSV) ou compactados.`,
    };
  }


  const maxBytes = maxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${maxMB}MB.`,
    };
  }

  return { valid: true };
}

export function validateFiles(files: File[], context: FileContext, maxMB = 20): FileValidationResult {
  for (const file of files) {
    const result = validateFile(file, context, maxMB);
    if (!result.valid) return result;
  }
  return { valid: true };
}
