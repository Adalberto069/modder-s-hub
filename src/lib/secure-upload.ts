import { toast } from "sonner";

// --- Allowed MIME types & extensions ---
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SCRIPT_MIMES = new Set([
  "text/plain",
  "text/x-lua",
  "application/x-lua",
  "application/octet-stream", // .lua fallback
]);

const SCRIPT_EXTENSIONS = new Set(["lua"]);
const APK_EXTENSIONS = new Set(["apk"]);
const APK_MIMES = new Set([
  "application/vnd.android.package-archive",
  "application/octet-stream", // browsers often report this for .apk
  "application/zip", // APK is a ZIP container
]);
const FORBIDDEN_DOUBLE_EXTENSIONS = new Set(["apk", "exe", "zip", "rar", "jar", "bin", "sh", "bat", "cmd"]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

// --- Dangerous byte signatures (magic bytes) ---
const DANGEROUS_SIGNATURES: Uint8Array[] = [
  new Uint8Array([0x4d, 0x5a]), // PE/EXE (MZ header)
  new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), // ELF binary
  new Uint8Array([0x23, 0x21]), // Shebang script (#!)
];

// APK files must start with the ZIP local-file-header signature "PK\x03\x04"
const APK_ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

type UploadType = "image" | "script" | "apk";

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
  const parts = filename.toLowerCase().split(".");
  if (parts.length < 2) return "";
  
  // Security check: look for double extensions (e.g., photo.exe.lua)
  if (parts.length > 2) {
    const secondToLast = parts[parts.length - 2];
    if (FORBIDDEN_DOUBLE_EXTENSIONS.has(secondToLast)) {
      throw new Error(`Tentativa de burla detectada: extensão dupla perigosa (.${secondToLast}.${parts.pop()})`);
    }
  }

  return (parts.pop() ?? "").replace(/[^a-z0-9]/g, "");
}

/**
 * Check file bytes for dangerous signatures (basic malware scan).
 */
async function scanForMalware(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 1024).arrayBuffer(); // Scan first KB
    const bytes = new Uint8Array(buffer);

    // 1. Signature check
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

    // 2. Binary check for scripts (ensure it's actually text)
    if (file.name.toLowerCase().endsWith(".lua")) {
      for (let i = 0; i < bytes.length; i++) {
        // Look for null bytes or lots of control chars which indicate binary
        if (bytes[i] === 0) return true; // Null bytes = definitely not a lua script
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
  let extension = "";
  let safeName = "";
  
  try {
    extension = getExtension(file.name);
    safeName = generateSafeFilename(extension);
  } catch (err: any) {
    return {
      valid: false,
      error: err.message,
      sanitizedName: "error",
      extension: "error",
    };
  }

  // 1. Size check (defaults: image 1MB, script 20MB, apk 200MB)
  const defaultMax = type === "image" ? 1 : type === "apk" ? 200 : 20;
  const maxSize = (maxSizeMB ?? defaultMax) * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo: ${maxSizeMB ?? defaultMax}MB`,
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
  const allowedExts =
    type === "image" ? IMAGE_EXTENSIONS : type === "apk" ? APK_EXTENSIONS : SCRIPT_EXTENSIONS;
  if (!extension || !allowedExts.has(extension)) {
    return {
      valid: false,
      error: `Formato não permitido. Aceitos: ${[...allowedExts].join(", ")}`,
      sanitizedName: safeName,
      extension,
    };
  }

  // 3. MIME type check
  if (type === "image" && !IMAGE_MIMES.has(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo inválido: ${file.type}. Aceitos: JPEG, PNG, WebP`,
      sanitizedName: safeName,
      extension,
    };
  }
  if (type === "apk" && file.type && !APK_MIMES.has(file.type)) {
    // some browsers report empty MIME for .apk — accept when empty, reject unknown values
    return {
      valid: false,
      error: `Tipo de arquivo inválido para APK: ${file.type}`,
      sanitizedName: safeName,
      extension,
    };
  }

  // 4. Content signature check
  if (type === "apk") {
    // APKs must be valid ZIP containers (start with "PK\x03\x04")
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const ok = head.length === 4 && head.every((b, i) => b === APK_ZIP_SIGNATURE[i]);
    if (!ok) {
      return {
        valid: false,
        error: "APK inválido: arquivo não é um pacote Android válido (assinatura ZIP ausente).",
        sanitizedName: safeName,
        extension,
      };
    }
  } else {
    const isDangerous = await scanForMalware(file);
    if (isDangerous) {
      return {
        valid: false,
        error: "Arquivo rejeitado: assinatura suspeita detectada",
        sanitizedName: safeName,
        extension,
      };
    }
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
