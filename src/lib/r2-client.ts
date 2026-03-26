/**
 * R2 client — thin wrapper around fetch calls to the Worker's R2 endpoints.
 *
 * All R2 access is proxied through the Cloudflare Worker.
 * The client automatically sets auth and target-DB headers.
 */

export interface R2UploadResult {
  key: string;
  size: number;
  etag: string;
}

export class R2Error extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "R2Error";
  }
}

/**
 * Encode each segment of an R2 key path, preserving slashes.
 * "policies/42/abc.pdf" → "policies/42/abc.pdf" (segments are URI-encoded)
 */
export function encodeR2KeyPath(key: string): string {
  return key
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

export function createR2Client(
  workerUrl: string,
  workerSecret: string,
  targetDb: string,
) {
  function headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${workerSecret}`,
      "X-Target-DB": targetDb,
    };
  }

  return {
    /**
     * Upload a file to R2.
     * When body is a ReadableStream, uses duplex: "half" for Node.js
     * compatibility (required for streaming request bodies in undici/Node fetch).
     */
    async upload(
      key: string,
      body: ReadableStream | ArrayBuffer,
      contentType: string,
    ): Promise<R2UploadResult> {
      const init: RequestInit & { duplex?: string } = {
        method: "PUT",
        headers: { ...headers(), "Content-Type": contentType },
        body,
      };
      // Node/undici fetch requires duplex: "half" for streaming request bodies.
      // ArrayBuffer bodies don't need it, but it's harmless to always set it.
      if (body instanceof ReadableStream) {
        init.duplex = "half";
      }
      const res = await fetch(
        `${workerUrl}/r2/${encodeR2KeyPath(key)}`,
        init,
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new R2Error(`Upload failed: ${text}`, res.status);
      }
      return (await res.json()) as R2UploadResult;
    },

    /**
     * Download a file from R2.
     * Returns the raw Response for streaming to the client.
     */
    async download(key: string): Promise<Response> {
      const res = await fetch(
        `${workerUrl}/r2/${encodeR2KeyPath(key)}`,
        {
          method: "GET",
          headers: headers(),
        },
      );
      if (!res.ok) {
        throw new R2Error(`Download failed`, res.status);
      }
      return res;
    },

    /**
     * Delete a file from R2.
     * Idempotent — does not throw if the key doesn't exist.
     */
    async delete(key: string): Promise<void> {
      const res = await fetch(
        `${workerUrl}/r2/${encodeR2KeyPath(key)}`,
        {
          method: "DELETE",
          headers: headers(),
        },
      );
      if (!res.ok) {
        throw new R2Error(`Delete failed`, res.status);
      }
    },
  };
}

export type R2Client = ReturnType<typeof createR2Client>;

/**
 * Create an R2 client from environment variables.
 * Reads SURETY_WORKER_URL and SURETY_WORKER_SECRET.
 */
export function getR2ClientFromEnv(targetDb: string): R2Client {
  const workerUrl = process.env.SURETY_WORKER_URL;
  if (!workerUrl) throw new Error("SURETY_WORKER_URL is not set");

  const workerSecret = process.env.SURETY_WORKER_SECRET;
  if (!workerSecret) throw new Error("SURETY_WORKER_SECRET is not set");

  return createR2Client(workerUrl, workerSecret, targetDb);
}
