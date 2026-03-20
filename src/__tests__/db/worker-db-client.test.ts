import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { WorkerDbClient, WorkerDbError } from "../../db/worker-db-client";

const WORKER_URL = "https://surety-db-proxy.example.workers.dev";
const SECRET = "test-secret-123";

// Mock fetch at module scope
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

beforeEach(() => {
  mockFetch = mock(() => Promise.resolve(new Response("{}")));
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("WorkerDbClient", () => {
  describe("constructor", () => {
    it("strips trailing slashes from worker URL", () => {
      const client = new WorkerDbClient("https://example.com///", SECRET);
      // Verify via a health call
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
        ),
      );
      client.health();
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://example.com/health");
    });
  });

  describe("query", () => {
    it("sends correct request to /query", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              results: [{ id: 1, name: "张三" }],
              meta: { changes: 0, duration: 1.2, rows_read: 1, rows_written: 0 },
            }),
            { status: 200 },
          ),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET, "production");
      const result = await client.query("SELECT * FROM members WHERE id = ?", [1]);

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${WORKER_URL}/query`);
      expect(init.method).toBe("POST");

      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${SECRET}`);
      expect(headers["X-Target-DB"]).toBe("production");

      const body = JSON.parse(init.body as string);
      expect(body.sql).toBe("SELECT * FROM members WHERE id = ?");
      expect(body.params).toEqual([1]);

      // Verify result
      expect(result.rows).toEqual([{ id: 1, name: "张三" }]);
      expect(result.meta.changes).toBe(0);
    });

    it("defaults params to empty array", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              results: [],
              meta: { changes: 0, duration: 0, rows_read: 0, rows_written: 0 },
            }),
            { status: 200 },
          ),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      await client.query("SELECT * FROM members");

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.params).toEqual([]);
    });

    it("throws WorkerDbError on HTTP error", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response("Internal Server Error", { status: 500 }),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      await expect(client.query("SELECT 1")).rejects.toThrow(WorkerDbError);
      await expect(client.query("SELECT 1")).rejects.toThrow(/500/);
    });

    it("throws WorkerDbError when success is false", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              error: "SQLITE_ERROR: no such table: foo",
            }),
            { status: 200 },
          ),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      await expect(client.query("SELECT * FROM foo")).rejects.toThrow(
        /no such table/,
      );
    });

    it("sends correct X-Target-DB header for e2e databases", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              results: [],
              meta: { changes: 0, duration: 0, rows_read: 0, rows_written: 0 },
            }),
            { status: 200 },
          ),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET, "api-e2e");
      await client.query("SELECT 1");

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["X-Target-DB"]).toBe("api-e2e");
    });
  });

  describe("batch", () => {
    it("sends correct request to /batch", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              results: [
                { results: [], meta: { changes: 1, duration: 0.5, rows_read: 0, rows_written: 1 } },
                { results: [{ id: 2 }], meta: { changes: 1, duration: 0.3, rows_read: 0, rows_written: 1 } },
              ],
            }),
            { status: 200 },
          ),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      const results = await client.batch([
        { sql: "DELETE FROM members WHERE id = ?", params: [1] },
        { sql: "INSERT INTO members (name) VALUES (?)", params: ["李四"] },
      ]);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${WORKER_URL}/batch`);
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body as string);
      expect(body.statements).toHaveLength(2);

      expect(results).toHaveLength(2);
      expect(results[0].meta.changes).toBe(1);
      expect(results[1].rows).toEqual([{ id: 2 }]);
    });

    it("throws WorkerDbError on HTTP error", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response("Bad Gateway", { status: 502 }),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      await expect(
        client.batch([{ sql: "SELECT 1" }]),
      ).rejects.toThrow(WorkerDbError);
    });

    it("throws WorkerDbError when success is false", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ success: false, error: "D1 batch error" }),
            { status: 200 },
          ),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      await expect(
        client.batch([{ sql: "SELECT 1" }]),
      ).rejects.toThrow(/D1 batch error/);
    });
  });

  describe("health", () => {
    it("returns true when healthy", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      expect(await client.health()).toBe(true);

      // Health should not send auth header
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${WORKER_URL}/health`);
    });

    it("returns false on HTTP error", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response("error", { status: 503 })),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      expect(await client.health()).toBe(false);
    });

    it("returns false on network error", async () => {
      mockFetch.mockImplementation(() =>
        Promise.reject(new Error("Network error")),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      expect(await client.health()).toBe(false);
    });

    it("returns false when status is not ok", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: "error" }), { status: 200 }),
        ),
      );

      const client = new WorkerDbClient(WORKER_URL, SECRET);
      expect(await client.health()).toBe(false);
    });
  });
});
