import { toast } from "sonner";

// --- Allowed MIME types & extensions ---
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const SCRIPT_MIMES = new Set([
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-zip-compressed",
  "application/octet-stream", // .lua, .apk fallback
]);

const SCRIPT_EXTENSIONS = new Set(["lua", "zip", "rar", "apk"]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

// --- Dangerous byte signatures (magic bytes) ---
const DANGEROUS_SIGNATURES: Uint8Array[] = [
  new Uint8Array([0x4d, 0x5a]), // PE/EXE (MZ header)
  new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), // ELF binary
  new Uint8Array([0x23, 0x21]), // Shebang script (#!)
];

type UploadType = "image" | "script";

interface ValidateOptions {
  file: File;
  type: UploadType;
  maxSizeMB?: number;
}

interface ValidateResult {
  valid: boolean;
  error?: string;
  sanitizedName: string;
  extension: string;
}

/**
 * Generate a safe, random filename. Never uses the original user-provided name.
 */
function generateSafeFilename(extension: string): string {
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${id}.${extension}`;
}

/**
 * Extract extension from original filename (lowercase, sanitized).
 */
function getExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Check file bytes for dangerous signatures (basic malware scan).
 */
async function scanForMalware(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (const sig of DANGEROUS_SIGNATURES) {
      if (bytes.length >= sig.length) {
        let match = true;
        for (let i = 0; i < sig.length; i++) {
          if (bytes[i] !== sig[i]) {
            match = false;
            break;
          }
        }
        if (match) return true; // dangerous
      }
    }

    return false; // clean
  } catch {
    return false;
  }
}

/**
 * Validate an image file's actual content by loading it as an image element.
 */
function validateImageContent(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

/**
 * Validate a file for upload. Returns validation result with a safe filename.
 */
export async function validateFile({
  file,
  type,
  maxSizeMB,
}: ValidateOptions): Promise<ValidateResult> {
  const extension = getExtension(file.name);
  const safeName = generateSafeFilename(extension);

  // 1. Size check
  const maxSize = (maxSizeMB ?? (type === "image" ? 2 : 20)) * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo: ${maxSizeMB ?? (type === "image" ? 2 : 20)}MB`,
      sanitizedName: safeName,
      extension,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "Arquivo vazio",
      sanitizedName: safeName,
      extension,
    };
  }

  // 2. Extension check
  const allowedExts = type === "image" ? IMAGE_EXTENSIONS : SCRIPT_EXTENSIONS;
  if (!extension || !allowedExts.has(extension)) {
    return {
      valid: false,
      error: `Formato não permitido. Aceitos: ${[...allowedExts].join(", ")}`,
      sanitizedName: safeName,
      extension,
    };
  }

  // 3. MIME type check
  const allowedMimes = type === "image" ? IMAGE_MIMES : SCRIPT_MIMES;
  if (type === "image" && !allowedMimes.has(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo inválido: ${file.type}. Aceitos: JPEG, PNG, GIF, WebP`,
      sanitizedName: safeName,
      extension,
    };
  }

  // 4. Malware signature scan
  const isDangerous = await scanForMalware(file);
  if (isDangerous) {
    return {
      valid: false,
      error: "Arquivo rejeitado: assinatura suspeita detectada",
      sanitizedName: safeName,
      extension,
    };
  }

  // 5. Image content validation (ensure it's actually an image)
  if (type === "image") {
    const isRealImage = await validateImageContent(file);
    if (!isRealImage) {
      return {
        valid: false,
        error: "Arquivo de imagem corrompido ou inválido",
        sanitizedName: safeName,
        extension,
      };
    }
  }

  return { valid: true, sanitizedName: safeName, extension };
}

/**
 * Validate and show toast on error. Returns null if invalid, or the safe filename if valid.
 */
export async function validateFileWithToast(
  options: ValidateOptions
): Promise<string | null> {
  const result = await validateFile(options);
  if (!result.valid) {
    toast.error(result.error ?? "Arquivo inválido");
    return null;
  }
  return result.sanitizedName;
}
