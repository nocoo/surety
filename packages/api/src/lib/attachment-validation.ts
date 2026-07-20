/**
 * Attachment validation rules and helper utilities.
 */

export const ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_ATTACHMENTS_PER_POLICY = 20;

export type ValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Check whether a content type is an image type.
 */
export function isImageContentType(contentType: string): boolean {
	return contentType.startsWith("image/");
}

/**
 * Validate a file for upload.
 * Checks content type and size constraints.
 */
export function validateFile(contentType: string, size: number): ValidationResult {
	if (!ALLOWED_CONTENT_TYPES.includes(contentType as AllowedContentType)) {
		return {
			valid: false,
			error: `Invalid file type: ${contentType}. Only PDF, JPG, and PNG files are allowed.`,
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
 * Extract file extension from filename, defaulting to "bin".
 */
export function extractExtension(filename: string): string {
	const parts = filename.split(".");
	if (parts.length < 2) return "bin";
	const ext = (parts[parts.length - 1] ?? "").toLowerCase().trim();
	return ext || "bin";
}

/** PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2d) */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

/** JPEG magic bytes: FF D8 FF */
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A */
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Check whether a byte buffer starts with the given magic bytes.
 */
function matchesMagic(header: Uint8Array, magic: Uint8Array): boolean {
	if (header.length < magic.length) return false;
	for (let i = 0; i < magic.length; i++) {
		if (header[i] !== magic[i]) return false;
	}
	return true;
}

/**
 * Validate that a File object begins with the correct magic bytes
 * for its declared content type.
 * Reads only the first 8 bytes — does not buffer the whole file.
 */
export async function validateMagicBytes(file: File): Promise<ValidationResult> {
	// Read enough bytes for the longest magic sequence (PNG = 8 bytes)
	const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());

	if (file.type === "application/pdf") {
		if (!matchesMagic(header, PDF_MAGIC)) {
			return {
				valid: false,
				error:
					header.length < PDF_MAGIC.length
						? "File too small to be a valid PDF."
						: "File is not a valid PDF (invalid header).",
			};
		}
		return { valid: true };
	}

	if (file.type === "image/jpeg") {
		if (!matchesMagic(header, JPEG_MAGIC)) {
			return {
				valid: false,
				error:
					header.length < JPEG_MAGIC.length
						? "File too small to be a valid JPEG."
						: "File is not a valid JPEG (invalid header).",
			};
		}
		return { valid: true };
	}

	if (file.type === "image/png") {
		if (!matchesMagic(header, PNG_MAGIC)) {
			return {
				valid: false,
				error:
					header.length < PNG_MAGIC.length
						? "File too small to be a valid PNG."
						: "File is not a valid PNG (invalid header).",
			};
		}
		return { valid: true };
	}

	// Unknown type that passed validateFile() — skip magic check
	return { valid: true };
}

/**
 * @deprecated Use `validateMagicBytes` instead. Kept for backward compatibility.
 */
export const validatePdfMagicBytes = validateMagicBytes;

/**
 * Format bytes into human-readable string.
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const value = bytes / k ** i;
	return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
