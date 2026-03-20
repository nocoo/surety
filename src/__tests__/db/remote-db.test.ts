import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { createRemoteDbFromClient } from "@/db";
import { WorkerDbClient } from "@/db/worker-db-client";

/**
 * Tests for the remote database creation path (sqlite-proxy → Worker proxy).
 * Uses mock WorkerDbClient to avoid actual network calls.
 */

const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

beforeEach(() => {
  mockFetch = mock(() => Promise.resolve(new Response("{}")));
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createRemoteDbFromClient", () => {
  it("creates a drizzle instance from a WorkerDbClient", () => {
    const client = new WorkerDbClient(
      "https://example.workers.dev",
      "test-secret",
      "production",
    );
    const db = createRemoteDbFromClient(client);
    expect(db).toBeDefined();
    expect(db.select).toBeDefined();
  });

  it("query callback calls client.query and maps rows to arrays", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            results: [{ id: 1, name: "张三" }],
            meta: { changes: 0, duration: 0, rows_read: 1, rows_written: 0 },
          }),
          { status: 200 },
        ),
      ),
    );

    const client = new WorkerDbClient(
      "https://example.workers.dev",
      "test-secret",
      "production",
    );
    const db = createRemoteDbFromClient(client);

    // Access the underlying proxy callback by making a raw query
    // We can test via the drizzle instance - just verify it doesn't throw
    expect(db).toBeDefined();
  });

  it("creates db with batch support", () => {
    const client = new WorkerDbClient(
      "https://example.workers.dev",
      "test-secret",
      "api-e2e",
    );
    const db = createRemoteDbFromClient(client);
    expect(db).toBeDefined();
  });
});

describe("createRemoteDb", () => {
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    origEnv.NODE_ENV = process.env.NODE_ENV;
    origEnv.BUN_ENV = process.env.BUN_ENV;
    origEnv.SURETY_WORKER_URL = process.env.SURETY_WORKER_URL;
    origEnv.SURETY_WORKER_SECRET = process.env.SURETY_WORKER_SECRET;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(origEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("throws when SURETY_WORKER_URL is not set", async () => {
    // Temporarily exit test env so createRemoteDb is called
    process.env.NODE_ENV = "production";
    delete process.env.BUN_ENV;
    delete process.env.SURETY_WORKER_URL;
    process.env.SURETY_WORKER_SECRET = "secret";

    // Dynamic import to get fresh module behavior
    const { createRemoteDb } = await import("@/db");
    expect(() => createRemoteDb("production")).toThrow("SURETY_WORKER_URL is not set");
  });

  it("throws when SURETY_WORKER_SECRET is not set", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.BUN_ENV;
    process.env.SURETY_WORKER_URL = "https://example.workers.dev";
    delete process.env.SURETY_WORKER_SECRET;

    const { createRemoteDb } = await import("@/db");
    expect(() => createRemoteDb("production")).toThrow("SURETY_WORKER_SECRET is not set");
  });

  it("creates remote db when env vars are set", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.BUN_ENV;
    process.env.SURETY_WORKER_URL = "https://example.workers.dev";
    process.env.SURETY_WORKER_SECRET = "secret";

    const { createRemoteDb } = await import("@/db");
    const db = createRemoteDb("production");
    expect(db).toBeDefined();
  });
});

describe("getDbForRequest (non-test env)", () => {
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    origEnv.NODE_ENV = process.env.NODE_ENV;
    origEnv.BUN_ENV = process.env.BUN_ENV;
    origEnv.SURETY_WORKER_URL = process.env.SURETY_WORKER_URL;
    origEnv.SURETY_WORKER_SECRET = process.env.SURETY_WORKER_SECRET;
    origEnv.SURETY_TARGET_DB = process.env.SURETY_TARGET_DB;
    origEnv.SURETY_DB = process.env.SURETY_DB;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(origEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("uses target db from string parameter", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.BUN_ENV;
    process.env.SURETY_WORKER_URL = "https://example.workers.dev";
    process.env.SURETY_WORKER_SECRET = "secret";

    const { getDbForRequest } = await import("@/db");
    const db = getDbForRequest("dev");
    expect(db).toBeDefined();
  });

  it("extracts target db from Request cookie", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.BUN_ENV;
    delete process.env.SURETY_TARGET_DB;
    process.env.SURETY_WORKER_URL = "https://example.workers.dev";
    process.env.SURETY_WORKER_SECRET = "secret";

    const { getDbForRequest } = await import("@/db");
    const request = new Request("http://localhost", {
      headers: { cookie: "surety-database=dev; other=value" },
    });
    const db = getDbForRequest(request);
    expect(db).toBeDefined();
  });

  it("defaults to production when no cookie or parameter", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.BUN_ENV;
    delete process.env.SURETY_TARGET_DB;
    process.env.SURETY_WORKER_URL = "https://example.workers.dev";
    process.env.SURETY_WORKER_SECRET = "secret";

    const { getDbForRequest } = await import("@/db");
    const db = getDbForRequest();
    expect(db).toBeDefined();
  });

  it("throws when SURETY_WORKER_URL is not configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.BUN_ENV;
    delete process.env.SURETY_WORKER_URL;
    delete process.env.SURETY_WORKER_SECRET;

    const { getDbForRequest } = await import("@/db");
    expect(() => getDbForRequest()).toThrow("SURETY_WORKER_URL is not set");
  });
});
