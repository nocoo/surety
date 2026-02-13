import { describe, expect, test } from "bun:test";
import { checkHealth, type HealthDeps, type HealthResult } from "@/lib/health";

/** Build a default deps object where the database is healthy. */
function healthyDeps(overrides: Partial<HealthDeps> = {}): HealthDeps {
  return {
    getRawSqlite: () => ({
      prepare: () => ({ get: () => ({ alive: 1 }) }),
    }),
    uptime: 12345.678,
    runtime: "bun",
    version: "0.1.0",
    rssBytes: 128 * 1024 * 1024, // 128 MB
    ...overrides,
  };
}

describe("checkHealth", () => {
  // ─── happy path ───────────────────────────────────────────────

  test("returns status ok when database is healthy", () => {
    const result = checkHealth(healthyDeps());

    expect(result.status).toBe("ok");
    expect(result.database.connected).toBe(true);
    expect(result.database.error).toBeUndefined();
  });

  test("includes timestamp in ISO format", () => {
    const before = new Date().toISOString().slice(0, 10);
    const result = checkHealth(healthyDeps());
    expect(result.timestamp.startsWith(before)).toBe(true);
  });

  test("rounds uptime to integer seconds", () => {
    const result = checkHealth(healthyDeps({ uptime: 99.99 }));
    expect(result.uptime).toBe(100);
  });

  test("reports runtime and version", () => {
    const result = checkHealth(
      healthyDeps({ runtime: "node", version: "1.2.3" }),
    );
    expect(result.runtime).toBe("node");
    expect(result.version).toBe("1.2.3");
  });

  test("converts rssBytes to rounded megabytes", () => {
    // 52.4 MB → 52
    const result = checkHealth(
      healthyDeps({ rssBytes: 52.4 * 1024 * 1024 }),
    );
    expect(result.memoryMB).toBe(52);
  });

  // ─── database probe failures ──────────────────────────────────

  test("returns error when getRawSqlite throws", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => {
          throw new Error("No database connection");
        },
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toBe("No database connection");
  });

  test("returns error when probe query returns null", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => ({
          prepare: () => ({ get: () => null }),
        }),
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toBe("empty result from probe query");
  });

  test("returns error when probe query returns undefined", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => ({
          prepare: () => ({ get: () => undefined }),
        }),
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toContain("empty result");
  });

  test("returns error with unknown message for non-Error throws", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => {
          throw "string error";
        },
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toBe("unknown database failure");
  });

  // ─── "ok" sanitisation in error messages ──────────────────────

  test("sanitises 'ok' from error messages to prevent false positives", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => {
          throw new Error("connection looks ok but timed out");
        },
      }),
    );

    expect(result.status).toBe("error");
    // The standalone word "ok" must not appear in any error field
    expect(result.database.error).not.toMatch(/\bok\b/i);
    expect(result.database.error).toContain("***");
  });

  test("sanitises case-insensitive 'OK' from error messages", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => {
          throw new Error("OK acknowledged but failed");
        },
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.error).not.toMatch(/\bok\b/i);
  });

  // ─── response shape ───────────────────────────────────────────

  test("always returns all required fields on success", () => {
    const result = checkHealth(healthyDeps());
    const keys: (keyof HealthResult)[] = [
      "status",
      "timestamp",
      "uptime",
      "database",
      "runtime",
      "version",
      "memoryMB",
    ];
    for (const key of keys) {
      expect(result).toHaveProperty(key);
    }
  });

  test("always returns all required fields on failure", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => {
          throw new Error("fail");
        },
      }),
    );
    const keys: (keyof HealthResult)[] = [
      "status",
      "timestamp",
      "uptime",
      "database",
      "runtime",
      "version",
      "memoryMB",
    ];
    for (const key of keys) {
      expect(result).toHaveProperty(key);
    }
  });

  // ─── edge cases ───────────────────────────────────────────────

  test("handles zero uptime", () => {
    const result = checkHealth(healthyDeps({ uptime: 0 }));
    expect(result.uptime).toBe(0);
    expect(result.status).toBe("ok");
  });

  test("handles very large rssBytes", () => {
    const result = checkHealth(
      healthyDeps({ rssBytes: 4 * 1024 * 1024 * 1024 }),
    ); // 4 GB
    expect(result.memoryMB).toBe(4096);
  });

  test("handles prepare throwing (not just getRawSqlite)", () => {
    const result = checkHealth(
      healthyDeps({
        getRawSqlite: () => ({
          prepare: () => {
            throw new Error("database is locked");
          },
        }),
      }),
    );

    expect(result.status).toBe("error");
    expect(result.database.connected).toBe(false);
    expect(result.database.error).toBe("database is locked");
  });
});
