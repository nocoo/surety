/**
 * Attachment validation rules and helper utilities.
 */

export const ALLOWED_CONTENT_TYPES = ["application/pdf"] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_ATTACHMENTS_PER_POLICY = 20;

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate a file for upload.
 * Checks content type and size constraints.
 */
export function validateFile(
  contentType: string,
  size: number,
): ValidationResult {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType as AllowedContentType)) {
    return {
      valid: false,
      error: `Invalid file type: ${contentType}. Only PDF files are allowed.`,
    };
  }
  if (size === 0) {
    return { valid: false, error: "File is empty." };
  }
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${formatBytes(size)}. Maximum is ${formatBytes(MAX_FILE_SIZE)}.`,
    };
  }
  return { valid: true };
}

/**
 * Generate a unique R2 object key for a policy attachment.
 * Format: policies/{policyId}/{uuid}.{ext}
 */
export function generateR2Key(policyId: number, filename: string): string {
  const uuid = crypto.randomUUID();
  const ext = extractExtension(filename);
  return `policies/${policyId}/${uuid}.${ext}`;
}

/**
 * Extract file extension from filename, defaulting to "pdf".
 */
export function extractExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "pdf";
  const ext = (parts[parts.length - 1] ?? "").toLowerCase().trim();
  return ext || "pdf";
}

/**
 * PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2d)
 */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

/**
 * Validate that a File object begins with the PDF magic bytes.
 * Uses file.slice(0,5) to read only the header — does not buffer the whole file.
 */
export async function validatePdfMagicBytes(
  file: File,
): Promise<ValidationResult> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (header.length < 5) {
    return { valid: false, error: "File too small to be a valid PDF." };
  }
  for (let i = 0; i < 5; i++) {
    if (header[i] !== PDF_MAGIC[i]) {
      return {
        valid: false,
        error: "File is not a valid PDF (invalid header).",
      };
    }
  }
  return { valid: true };
}

/**
 * Format bytes into human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
