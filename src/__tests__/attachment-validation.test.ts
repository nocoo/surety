import { describe, expect, test } from "bun:test";
import {
  validateFile,
  validatePdfMagicBytes,
  generateR2Key,
  extractExtension,
  formatBytes,
  MAX_FILE_SIZE,
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENTS_PER_POLICY,
} from "@/lib/attachment-validation";

describe("attachment-validation", () => {
  describe("validateFile", () => {
    test("accepts valid PDF", () => {
      const result = validateFile("application/pdf", 1024);
      expect(result).toEqual({ valid: true });
    });

    test("rejects non-PDF content type", () => {
      const result = validateFile("image/png", 1024);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("image/png");
        expect(result.error).toContain("Only PDF");
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

    test("rejects text/plain", () => {
      const result = validateFile("text/plain", 1024);
      expect(result.valid).toBe(false);
    });

    test("rejects application/json", () => {
      const result = validateFile("application/json", 1024);
      expect(result.valid).toBe(false);
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

    test("defaults to pdf when no extension", () => {
      const key = generateR2Key(1, "document");
      expect(key).toMatch(/\.pdf$/);
    });

    test("handles complex filenames", () => {
      const key = generateR2Key(10, "某某保单.v2.final.pdf");
      expect(key).toMatch(/^policies\/10\/[0-9a-f-]+\.pdf$/);
    });
  });

  describe("extractExtension", () => {
    test("extracts pdf", () => {
      expect(extractExtension("file.pdf")).toBe("pdf");
    });

    test("lowercases extension", () => {
      expect(extractExtension("file.PDF")).toBe("pdf");
    });

    test("defaults to pdf for no extension", () => {
      expect(extractExtension("file")).toBe("pdf");
    });

    test("handles multiple dots", () => {
      expect(extractExtension("file.v2.pdf")).toBe("pdf");
    });

    test("handles empty extension", () => {
      expect(extractExtension("file.")).toBe("pdf");
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

    test("MAX_FILE_SIZE is 50MB", () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    });

    test("MAX_ATTACHMENTS_PER_POLICY is 20", () => {
      expect(MAX_ATTACHMENTS_PER_POLICY).toBe(20);
    });
  });

  describe("validatePdfMagicBytes", () => {
    function createFile(bytes: Uint8Array, type = "application/pdf"): File {
      return new File([bytes.buffer as ArrayBuffer], "test.pdf", { type });
    }

    // Real PDF header: %PDF-1.4
    const validPdfHeader = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
    ]);

    test("accepts valid PDF magic bytes", async () => {
      const file = createFile(validPdfHeader);
      const result = await validatePdfMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });

    test("rejects file with wrong magic bytes", async () => {
      // PNG header
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const file = createFile(pngHeader);
      const result = await validatePdfMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("not a valid PDF");
      }
    });

    test("rejects file too small to have magic bytes", async () => {
      const file = createFile(new Uint8Array([0x25, 0x50]));
      const result = await validatePdfMagicBytes(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("too small");
      }
    });

    test("rejects empty file", async () => {
      const file = createFile(new Uint8Array([]));
      const result = await validatePdfMagicBytes(file);
      expect(result.valid).toBe(false);
    });

    test("accepts file with exactly 5 magic bytes", async () => {
      const exact = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = createFile(exact);
      const result = await validatePdfMagicBytes(file);
      expect(result).toEqual({ valid: true });
    });

    test("rejects text file disguised as PDF", async () => {
      const textContent = new TextEncoder().encode("This is not a PDF");
      const file = createFile(textContent);
      const result = await validatePdfMagicBytes(file);
      expect(result.valid).toBe(false);
    });
  });
});
