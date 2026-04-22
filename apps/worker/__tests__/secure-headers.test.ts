/**
 * Verifies the global secureHeaders middleware applies to API routes,
 * including the unauthenticated /api/live endpoint.
 */
import { describe, expect, test } from "bun:test";
import app from "../src/index";

const stubDb = {
  prepare() {
    return {
      first: async () => ({ probe: 1 }),
    };
  },
};

const env = { DB: stubDb } as unknown as Record<string, unknown>;

describe("secureHeaders middleware", () => {
  test("/api/live returns X-Content-Type-Options: nosniff", async () => {
    const res = await app.request(
      "/api/live",
      { headers: { host: "localhost:7016" } },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("/api/live returns X-Frame-Options: SAMEORIGIN", async () => {
    const res = await app.request(
      "/api/live",
      { headers: { host: "localhost:7016" } },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  test("API responses include X-Content-Type-Options header", async () => {
    const res = await app.request(
      "/api/me",
      { headers: { host: "localhost:7016" } },
      env,
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("API responses include X-Frame-Options header", async () => {
    const res = await app.request(
      "/api/me",
      { headers: { host: "localhost:7016" } },
      env,
    );
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });
});
