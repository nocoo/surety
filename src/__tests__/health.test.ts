import { describe, expect, test } from "bun:test";
import { checkHealth, type HealthDeps } from "@/lib/health";
import { APP_VERSION } from "@/lib/version";

/** Build a default deps object where the database is healthy. */
function healthyDeps(overrides: Partial<HealthDeps> = {}): HealthDeps {
  return {
    probeDatabase: async () => ({ connected: true }),
    uptime: 12345.678,
    runtime: "bun",
    version: APP_VERSION,
    rssBytes: 128 * 1024 * 1024, // 128 MB
    ...overrides,
  };
}

describe("checkHealth", () => {
  // ─── happy path ───────────────────────────────────────────────

  test("returns status ok when database is healthy", async () => {
    const result = await checkHealth(healthyDeps());

    expect(result.status).toBe("ok");
    expect(result.database.connected).toBe(true);
    expect(result.database.error).toBeUndefined();
  });

  test("includes timestamp in ISO format", async () => {
    const before = new Date().toISOString().slice(0, 10);
    const result = await checkHealth(healthyDeps());
    expect(result.timestamp.startsWith(before)).toBe(true);
  });

  test("rounds uptime to integer seconds", async () => {
    const result = await checkHealth(healthyDeps({ uptime: 99.99 }));
    expect(result.uptime).toBe(100);
  });

  test("reports runtime and version", async () => {
    const result = await checkHealth(
      healthyDeps({ runtime: "node", version: "1.2.3" }),
    );
    expect(result.runtime).toBe("node");
    expect(result.version).toBe("1.2.3");
  });

  test("converts rssBytes to rounded megabytes", async () => {
    // 52.4 MB → 52
    const result = await checkHealth(
      healthyDeps({ rssBytes: 52.4 * 1024 * 1024 }),
    );
    expect(result.memoryMB).toBe(52);
  });

  // ─── database probe failures ──────────────────────────────────

  test("returns error when probeDatabase returns not connected", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => ({
          connected: false,
          error: "No database connection",
        }),
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toBe("No database connection");
  });

  test("returns error when probeDatabase throws", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => {
          throw new Error("connection refused");
        },
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toBe("connection refused");
  });

  test("returns error when probeDatabase returns empty result", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => ({
          connected: false,
          error: "empty result from probe query",
        }),
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toContain("empty result");
  });

  test("returns error with unknown message for non-Error throws", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => {
          throw "string error";
        },
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toBe("unknown database failure");
  });

  // ─── "ok" sanitisation in error messages ──────────────────────

  test("sanitises 'ok' from error messages to prevent false positives", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => {
          throw new Error("connection looks ok but timed out");
        },
      }),
    );

    expect(result.status).toBe("error");
    // The standalone word "ok" must not appear in any error field
    expect(result.database.error).not.toMatch(/\bok\b/i);
    expect(result.database.error).toContain("***");
  });

  test("sanitises case-insensitive 'OK' from error messages", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => {
          throw new Error("OK acknowledged but failed");
        },
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.error).not.toMatch(/\bok\b/i);
  });

  test("sanitises 'ok' in probeDatabase error field", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => ({
          connected: false,
          error: "connection looks ok but timed out",
        }),
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.error).not.toMatch(/\bok\b/i);
    expect(result.database.error).toContain("***");
  });

  // ─── edge cases ───────────────────────────────────────────────

  test("handles zero uptime", async () => {
    const result = await checkHealth(healthyDeps({ uptime: 0 }));
    expect(result.uptime).toBe(0);
    expect(result.status).toBe("ok");
  });

  test("handles very large rssBytes", async () => {
    const result = await checkHealth(
      healthyDeps({ rssBytes: 4 * 1024 * 1024 * 1024 }),
    ); // 4 GB
    expect(result.memoryMB).toBe(4096);
  });

  test("handles probeDatabase returning not connected without error", async () => {
    const result = await checkHealth(
      healthyDeps({
        probeDatabase: async () => ({ connected: false }),
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toContain("database probe returned not connected");
  });
});
