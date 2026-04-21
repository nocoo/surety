import { describe, expect, test } from "bun:test";
import {
  validateFile,
  validateMagicBytes,
  validatePdfMagicBytes,
  generateR2Key,
  extractExtension,
  formatBytes,
  isImageContentType,
  MAX_FILE_SIZE,
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENTS_PER_POLICY,
} from "@surety/api/lib/attachment-validation";

describe("attachment-validation", () => {
  describe("validateFile", () => {
    test("accepts valid PDF", () => {
      const result = validateFile("application/pdf", 1024);
      expect(result).toEqual({ valid: true });
    });

    test("accepts valid JPEG", () => {
      const result = validateFile("image/jpeg", 1024);
      expect(result).toEqual({ valid: true });
    });

    test("accepts valid PNG", () => {
      const result = validateFile("image/png", 1024);
      expect(result).toEqual({ valid: true });
    });

    test("rejects unsupported content type", () => {
      const result = validateFile("text/plain", 1024);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("text/plain");
        expect(result.error).toContain("PDF, JPG, and PNG");
      }
    });

    test("rejects empty file", () => {
      const result = validateFile("application/pdf", 0);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("empty");
      }
    });

    test("rejects oversized file", () => {
      const result = validateFile("application/pdf", MAX_FILE_SIZE + 1);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("too large");
      }
    });

    test("accepts file at exactly MAX_FILE_SIZE", () => {
      const result = validateFile("application/pdf", MAX_FILE_SIZE);
      expect(result).toEqual({ valid: true });
    });

    test("rejects application/json", () => {
      const result = validateFile("application/json", 1024);
      expect(result.valid).toBe(false);
    });

    test("rejects image/gif", () => {
      const result = validateFile("image/gif", 1024);
      expect(result.valid).toBe(false);
    });
  });

  describe("isImageContentType", () => {
    test("returns true for image/jpeg", () => {
      expect(isImageContentType("image/jpeg")).toBe(true);
    });

    test("returns true for image/png", () => {
      expect(isImageContentType("image/png")).toBe(true);
    });

    test("returns false for application/pdf", () => {
      expect(isImageContentType("application/pdf")).toBe(false);
    });

    test("returns false for text/plain", () => {
      expect(isImageContentType("text/plain")).toBe(false);
    });
  });

  describe("generateR2Key", () => {
    test("produces correct format: policies/{id}/{uuid}.pdf", () => {
      const key = generateR2Key(42, "my-policy.pdf");
      expect(key).toMatch(/^policies\/42\/[0-9a-f-]+\.pdf$/);
    });

    test("generates unique keys across calls", () => {
      const key1 = generateR2Key(1, "file.pdf");
      const key2 = generateR2Key(1, "file.pdf");
      expect(key1).not.toBe(key2);
    });

    test("extracts extension from filename", () => {
      const key = generateR2Key(1, "document.PDF");
      expect(key).toMatch(/\.pdf$/);
    });

    test("defaults to bin when no extension", () => {
      const key = generateR2Key(1, "document");
      expect(key).toMatch(/\.bin$/);
    });

    test("handles complex filenames", () => {
      const key = generateR2Key(10, "某某保单.v2.final.pdf");
      expect(key).toMatch(/^policies\/10\/[0-9a-f-]+\.pdf$/);
    });

    test("handles image filenames", () => {
      const key = generateR2Key(5, "photo.jpg");
      expect(key).toMatch(/^policies\/5\/[0-9a-f-]+\.jpg$/);
    });
  });

  describe("extractExtension", () => {
    test("extracts pdf", () => {
      expect(extractExtension("file.pdf")).toBe("pdf");
    });

    test("extracts jpg", () => {
      expect(extractExtension("photo.jpg")).toBe("jpg");
    });

    test("extracts png", () => {
      expect(extractExtension("screenshot.png")).toBe("png");
    });

    test("lowercases extension", () => {
      expect(extractExtension("file.PDF")).toBe("pdf");
    });

    test("defaults to bin for no extension", () => {
      expect(extractExtension("file")).toBe("bin");
    });

    test("handles multiple dots", () => {
      expect(extractExtension("file.v2.pdf")).toBe("pdf");
    });

    test("handles empty extension", () => {
      expect(extractExtension("file.")).toBe("bin");
    });
  });

  describe("formatBytes", () => {
    test("formats 0 bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    test("formats bytes", () => {
      expect(formatBytes(500)).toBe("500 B");
    });

    test("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
    });

    test("formats megabytes", () => {
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    });

    test("formats 50MB", () => {
      expect(formatBytes(50 * 1024 * 1024)).toBe("50.0 MB");
    });

    test("formats fractional MB", () => {
      expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    });
  });

  describe("constants", () => {
    test("ALLOWED_CONTENT_TYPES contains application/pdf", () => {
      expect(ALLOWED_CONTENT_TYPES).toContain("application/pdf");
    });

    test("ALLOWED_CONTENT_TYPES contains image/jpeg", () => {
      expect(ALLOWED_CONTENT_TYPES).toContain("image/jpeg");
    });

    test("ALLOWED_CONTENT_TYPES contains image/png", () => {
      expect(ALLOWED_CONTENT_TYPES).toContain("image/png");
    });

    test("ALLOWED_CONTENT_TYPES has exactly 3 entries", () => {
      expect(ALLOWED_CONTENT_TYPES).toHaveLength(3);
    });

    test("MAX_FILE_SIZE is 50MB", () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    });

    test("MAX_ATTACHMENTS_PER_POLICY is 20", () => {
      expect(MAX_ATTACHMENTS_PER_POLICY).toBe(20);
    });
  });

  describe("validateMagicBytes", () => {
    function createFile(bytes: Uint8Array, type: string, name = "test"): File {
      return new File([bytes.buffer as ArrayBuffer], name, { type });
    }

    // Real PDF header: %PDF-1.4
    const validPdfHeader = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
    ]);

    // Real JPEG header: FF D8 FF E0 (JFIF)
    const validJpegHeader = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    ]);

    // Real PNG header: 89 50 4E 47 0D 0A 1A 0A
    const validPngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    // --- PDF ---
    test("accepts valid PDF magic bytes", async () => {
      const file = createFile(validPdfHeader, "application/pdf", "test.pdf");
      const result = await validateMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });

    test("rejects PDF with wrong magic bytes", async () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const file = createFile(pngHeader, "application/pdf", "test.pdf");
      const result = await validateMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("not a valid PDF");
      }
    });

    test("rejects PDF file too small to have magic bytes", async () => {
      const file = createFile(new Uint8Array([0x25, 0x50]), "application/pdf", "test.pdf");
      const result = await validateMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("too small");
      }
    });

    test("accepts PDF with exactly 5 magic bytes", async () => {
      const exact = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = createFile(exact, "application/pdf", "test.pdf");
      const result = await validateMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });

    test("rejects text file disguised as PDF", async () => {
      const textContent = new TextEncoder().encode("This is not a PDF");
      const file = createFile(textContent, "application/pdf", "test.pdf");
      const result = await validateMagicBytes(file);
      expect(result.valid).toBe(false);
    });

    // --- JPEG ---
    test("accepts valid JPEG magic bytes", async () => {
      const file = createFile(validJpegHeader, "image/jpeg", "photo.jpg");
      const result = await validateMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });

    test("rejects JPEG with wrong magic bytes", async () => {
      const wrongHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = createFile(wrongHeader, "image/jpeg", "photo.jpg");
      const result = await validateMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("not a valid JPEG");
      }
    });

    test("rejects JPEG file too small", async () => {
      const file = createFile(new Uint8Array([0xff, 0xd8]), "image/jpeg", "photo.jpg");
      const result = await validateMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("too small");
      }
    });

    test("accepts JPEG with exactly 3 magic bytes", async () => {
      const exact = new Uint8Array([0xff, 0xd8, 0xff]);
      const file = createFile(exact, "image/jpeg", "photo.jpg");
      const result = await validateMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });

    // --- PNG ---
    test("accepts valid PNG magic bytes", async () => {
      const file = createFile(validPngHeader, "image/png", "screenshot.png");
      const result = await validateMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });

    test("rejects PNG with wrong magic bytes", async () => {
      const wrongHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const file = createFile(wrongHeader, "image/png", "screenshot.png");
      const result = await validateMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("not a valid PNG");
      }
    });

    test("rejects PNG file too small", async () => {
      const file = createFile(new Uint8Array([0x89, 0x50, 0x4e]), "image/png", "screenshot.png");
      const result = await validateMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("too small");
      }
    });

    test("rejects empty file for any type", async () => {
      const pdfFile = createFile(new Uint8Array([]), "application/pdf", "test.pdf");
      const jpgFile = createFile(new Uint8Array([]), "image/jpeg", "test.jpg");
      const pngFile = createFile(new Uint8Array([]), "image/png", "test.png");

      expect((await validateMagicBytes(pdfFile)).valid).toBe(false);
      expect((await validateMagicBytes(jpgFile)).valid).toBe(false);
      expect((await validateMagicBytes(pngFile)).valid).toBe(false);
    });

    // --- Unknown type passthrough ---
    test("passes unknown content type without magic check", async () => {
      const file = createFile(new Uint8Array([0x00, 0x01]), "application/octet-stream", "data.bin");
      const result = await validateMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });
  });

  describe("validatePdfMagicBytes (deprecated alias)", () => {
    test("is same function as validateMagicBytes", () => {
      expect(validatePdfMagicBytes).toBe(validateMagicBytes);
    });
  });
});
