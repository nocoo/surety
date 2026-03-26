import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  encodeR2KeyPath,
  R2Error,
  createR2Client,
  getR2ClientFromEnv,
} from "@/lib/r2-client";

describe("r2-client", () => {
  describe("encodeR2KeyPath", () => {
    test("preserves slashes", () => {
      expect(encodeR2KeyPath("policies/42/abc.pdf")).toBe(
        "policies/42/abc.pdf",
      );
    });

    test("encodes special characters in segments", () => {
      const result = encodeR2KeyPath("policies/42/file name.pdf");
      expect(result).toBe("policies/42/file%20name.pdf");
    });

    test("handles Unicode filenames", () => {
      const result = encodeR2KeyPath("policies/42/保单.pdf");
      expect(result).toContain("policies/42/");
      expect(result).toContain(".pdf");
    });

    test("handles single segment", () => {
      expect(encodeR2KeyPath("simple.pdf")).toBe("simple.pdf");
    });

    test("handles empty string", () => {
      expect(encodeR2KeyPath("")).toBe("");
    });
  });

  describe("R2Error", () => {
    test("has correct name and status", () => {
      const error = new R2Error("test error", 404);
      expect(error.name).toBe("R2Error");
      expect(error.message).toBe("test error");
      expect(error.status).toBe(404);
    });

    test("is instanceof Error", () => {
      const error = new R2Error("test", 500);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("createR2Client", () => {
    const WORKER_URL = "https://test.workers.dev";
    const SECRET = "test-secret";
    const TARGET_DB = "test";

    // Save and restore original fetch
    const originalFetch = globalThis.fetch;

    function mockFetchWith(
      fn: (url: string, init: RequestInit) => Promise<Response>,
    ) {
      globalThis.fetch = fn as unknown as typeof fetch;
    }

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("upload sends correct headers and URL", async () => {
      let callCount = 0;
      mockFetchWith(async (url: string, init: RequestInit) => {
        callCount++;
        expect(url).toBe(
          `${WORKER_URL}/r2/policies/1/abc.pdf`,
        );
        expect(init.method).toBe("PUT");
        const headers = init.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe(`Bearer ${SECRET}`);
        expect(headers["X-Target-DB"]).toBe(TARGET_DB);
        expect(headers["Content-Type"]).toBe("application/pdf");

        return new Response(
          JSON.stringify({ key: "policies/1/abc.pdf", size: 100, etag: "abc" }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      });

      const client = createR2Client(WORKER_URL, SECRET, TARGET_DB);
      const result = await client.upload(
        "policies/1/abc.pdf",
        new ArrayBuffer(100),
        "application/pdf",
      );

      expect(result.key).toBe("policies/1/abc.pdf");
      expect(result.size).toBe(100);
      expect(callCount).toBe(1);
    });

    test("upload throws R2Error on failure", async () => {
      mockFetchWith(async () => {
        return new Response("Server error", { status: 500 });
      });

      const client = createR2Client(WORKER_URL, SECRET, TARGET_DB);
      await expect(
        client.upload("key.pdf", new ArrayBuffer(10), "application/pdf"),
      ).rejects.toThrow(R2Error);
    });

    test("upload sets duplex half for ReadableStream body", async () => {
      mockFetchWith(async (_url: string, init: RequestInit) => {
        expect((init as RequestInit & { duplex?: string }).duplex).toBe("half");
        return new Response(
          JSON.stringify({ key: "k", size: 0, etag: "e" }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      });

      const client = createR2Client(WORKER_URL, SECRET, TARGET_DB);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });
      await client.upload("key.pdf", stream, "application/pdf");
    });

    test("download sends correct headers and returns response", async () => {
      const body = "PDF content";
      mockFetchWith(async (url: string, init: RequestInit) => {
        expect(url).toBe(`${WORKER_URL}/r2/policies/1/abc.pdf`);
        expect(init.method).toBe("GET");
        const headers = init.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe(`Bearer ${SECRET}`);
        return new Response(body, { status: 200 });
      });

      const client = createR2Client(WORKER_URL, SECRET, TARGET_DB);
      const response = await client.download("policies/1/abc.pdf");
      expect(await response.text()).toBe(body);
    });

    test("download throws R2Error on 404", async () => {
      mockFetchWith(async () => {
        return new Response("Not found", { status: 404 });
      });

      const client = createR2Client(WORKER_URL, SECRET, TARGET_DB);
      try {
        await client.download("missing.pdf");
        expect(true).toBe(false); // should not reach
      } catch (error) {
        expect(error).toBeInstanceOf(R2Error);
        expect((error as R2Error).status).toBe(404);
      }
    });

    test("delete sends correct headers", async () => {
      mockFetchWith(async (url: string, init: RequestInit) => {
        expect(url).toBe(`${WORKER_URL}/r2/policies/1/abc.pdf`);
        expect(init.method).toBe("DELETE");
        const headers = init.headers as Record<string, string>;
        expect(headers["Authorization"]).toBe(`Bearer ${SECRET}`);
        return new Response(null, { status: 204 });
      });

      const client = createR2Client(WORKER_URL, SECRET, TARGET_DB);
      await client.delete("policies/1/abc.pdf");
    });

    test("delete throws R2Error on failure", async () => {
      mockFetchWith(async () => {
        return new Response("Error", { status: 500 });
      });

      const client = createR2Client(WORKER_URL, SECRET, TARGET_DB);
      await expect(client.delete("key.pdf")).rejects.toThrow(R2Error);
    });
  });

  describe("getR2ClientFromEnv", () => {
    const originalUrl = process.env.SURETY_WORKER_URL;
    const originalSecret = process.env.SURETY_WORKER_SECRET;

    beforeEach(() => {
      process.env.SURETY_WORKER_URL = "https://test.workers.dev";
      process.env.SURETY_WORKER_SECRET = "test-secret";
    });

    afterEach(() => {
      if (originalUrl !== undefined) {
        process.env.SURETY_WORKER_URL = originalUrl;
      } else {
        delete process.env.SURETY_WORKER_URL;
      }
      if (originalSecret !== undefined) {
        process.env.SURETY_WORKER_SECRET = originalSecret;
      } else {
        delete process.env.SURETY_WORKER_SECRET;
      }
    });

    test("creates client from env vars", () => {
      const client = getR2ClientFromEnv("production");
      expect(client).toBeDefined();
      expect(typeof client.upload).toBe("function");
      expect(typeof client.download).toBe("function");
      expect(typeof client.delete).toBe("function");
    });

    test("throws when SURETY_WORKER_URL is not set", () => {
      delete process.env.SURETY_WORKER_URL;
      expect(() => getR2ClientFromEnv("production")).toThrow(
        "SURETY_WORKER_URL is not set",
      );
    });

    test("throws when SURETY_WORKER_SECRET is not set", () => {
      delete process.env.SURETY_WORKER_SECRET;
      expect(() => getR2ClientFromEnv("production")).toThrow(
        "SURETY_WORKER_SECRET is not set",
      );
    });
  });
});
