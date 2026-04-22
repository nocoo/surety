import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createRateLimiter } from "../src/middleware/rate-limit";
import type { AppEnv } from "../src/lib/types";

function makeApp(max: number, windowMs: number) {
  const app = new Hono<AppEnv>();
  app.use("*", createRateLimiter({ max, windowMs }));
  app.get("/api/probe", (c) => c.text("ok"));
  return app;
}

describe("createRateLimiter", () => {
  test("requests under the limit return 200", async () => {
    const app = makeApp(3, 60_000);
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/api/probe", {
        headers: { "CF-Connecting-IP": "1.1.1.1" },
      });
      expect(res.status).toBe(200);
    }
  });

  test("requests over the limit return 429 with Retry-After header", async () => {
    const app = makeApp(2, 60_000);
    await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "2.2.2.2" },
    });
    await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "2.2.2.2" },
    });
    const res = await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "2.2.2.2" },
    });
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    const seconds = Number(retryAfter);
    expect(Number.isFinite(seconds)).toBe(true);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  test("counter resets after window expires", async () => {
    const app = makeApp(1, 30);
    const first = await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "3.3.3.3" },
    });
    expect(first.status).toBe(200);
    const blocked = await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "3.3.3.3" },
    });
    expect(blocked.status).toBe(429);

    await new Promise((r) => setTimeout(r, 50));

    const after = await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "3.3.3.3" },
    });
    expect(after.status).toBe(200);
  });

  test("different IPs have independent counters", async () => {
    const app = makeApp(1, 60_000);
    const a1 = await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "10.0.0.1" },
    });
    expect(a1.status).toBe(200);
    const a2 = await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "10.0.0.1" },
    });
    expect(a2.status).toBe(429);

    const b1 = await app.request("/api/probe", {
      headers: { "CF-Connecting-IP": "10.0.0.2" },
    });
    expect(b1.status).toBe(200);
  });

  test("falls back to X-Forwarded-For when CF-Connecting-IP is absent", async () => {
    const app = makeApp(1, 60_000);
    const r1 = await app.request("/api/probe", {
      headers: { "X-Forwarded-For": "9.9.9.9, 8.8.8.8" },
    });
    expect(r1.status).toBe(200);
    const r2 = await app.request("/api/probe", {
      headers: { "X-Forwarded-For": "9.9.9.9, 8.8.8.8" },
    });
    expect(r2.status).toBe(429);
  });

  test("falls back to x-real-ip when other headers are absent", async () => {
    const app = makeApp(1, 60_000);
    const r1 = await app.request("/api/probe", {
      headers: { "x-real-ip": "7.7.7.7" },
    });
    expect(r1.status).toBe(200);
    const r2 = await app.request("/api/probe", {
      headers: { "x-real-ip": "7.7.7.7" },
    });
    expect(r2.status).toBe(429);
  });
});
