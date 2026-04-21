import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, getBaseUrl } from "./setup";

interface LiveResponse {
  status: "ok" | "error";
  timestamp: string;
  uptime: number;
  database: { connected: boolean; error?: string };
  runtime: string;
  version: string;
  memoryMB: number;
}

describe("Live API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  test("GET /api/live returns 200", async () => {
    const response = await fetch(`${getBaseUrl()}/api/live`);
    expect(response.status).toBe(200);
  });

  test("response has correct structure", async () => {
    const response = await fetch(`${getBaseUrl()}/api/live`);
    const data: LiveResponse = await response.json();

    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(typeof data.uptime).toBe("number");
    expect(data.database.connected).toBe(true);
    expect(typeof data.runtime).toBe("string");
    expect(typeof data.version).toBe("string");
    expect(typeof data.memoryMB).toBe("number");
  });

  test("has no-cache headers", async () => {
    const response = await fetch(`${getBaseUrl()}/api/live`);

    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  test("version is a semver string", async () => {
    const response = await fetch(`${getBaseUrl()}/api/live`);
    const data: LiveResponse = await response.json();

    // Should match semver pattern (e.g. 1.2.3)
    expect(data.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
