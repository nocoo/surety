/**
 * Unit tests for the originGuard middleware.
 *
 * Covers:
 *  - safe methods (GET/HEAD/OPTIONS) always pass
 *  - Bearer-authenticated unsafe writes are exempt (CORS protects them)
 *  - session-cookie / Access-JWT writes from same-origin pass
 *  - session-cookie / Access-JWT writes from another origin are 403
 *  - missing Origin AND missing Referer on an unsafe write is 403
 *  - Referer is accepted when Origin is absent
 *  - /api/live and localhost dev are exempt
 *  - E2E_SKIP_AUTH=true bypass works (non-prod only)
 *  - production host with E2E_SKIP_AUTH=true is NOT exempt
 */
import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { originGuard } from "../src/middleware/origin-guard";
import type { AppEnv } from "../src/lib/types";

function makeApp() {
  const app = new Hono<AppEnv>();
  app.use("*", originGuard);
  app.get("/api/live", (c) => c.text("live"));
  app.get("/api/things", (c) => c.json({ ok: true }));
  app.post("/api/things", (c) => c.json({ created: true }, 201));
  app.delete("/api/things/:id", (c) => c.json({ deleted: true }));
  return app;
}

const PROD_HOST = "surety.hexly.ai";
const PROD_ORIGIN = `https://${PROD_HOST}`;

describe("originGuard middleware", () => {
  test("GET requests are never blocked, even cross-origin", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      headers: { host: PROD_HOST, origin: "https://evil.example" },
    });
    expect(res.status).toBe(200);
  });

  test("HEAD requests are never blocked", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "HEAD",
      headers: { host: PROD_HOST, origin: "https://evil.example" },
    });
    expect(res.status).toBe(200);
  });

  test("OPTIONS requests are never blocked", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "OPTIONS",
      headers: { host: PROD_HOST, origin: "https://evil.example" },
    });
    // hono returns 404 for unhandled OPTIONS, but the point is the guard
    // didn't 403 us — assert anything other than 403.
    expect(res.status).not.toBe(403);
  });

  test("unsafe write with same-origin Origin passes", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "POST",
      headers: { host: PROD_HOST, origin: PROD_ORIGIN },
      body: "{}",
    });
    expect(res.status).toBe(201);
  });

  test("unsafe write with cross-origin Origin is rejected (403)", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "POST",
      headers: { host: PROD_HOST, origin: "https://evil.example" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/cross-origin/i);
  });

  test("unsafe write with Bearer token is exempt even cross-origin", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "POST",
      headers: {
        host: PROD_HOST,
        origin: "https://evil.example",
        authorization: "Bearer sk_xxx",
      },
      body: "{}",
    });
    expect(res.status).toBe(201);
  });

  test("unsafe write without Origin or Referer header is rejected (403)", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "POST",
      headers: { host: PROD_HOST },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  test("unsafe write uses Referer when Origin is absent (same-origin pass)", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "POST",
      headers: {
        host: PROD_HOST,
        referer: `${PROD_ORIGIN}/policies`,
      },
      body: "{}",
    });
    expect(res.status).toBe(201);
  });

  test("unsafe write uses Referer when Origin is absent (cross-origin fail)", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things", {
      method: "POST",
      headers: {
        host: PROD_HOST,
        referer: "https://evil.example/abuse",
      },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });

  test("malformed Referer with no Origin → 403", async () => {
    const app = makeApp();
    const res = await app.request("https://surety.hexly.ai/api/things/9", {
      method: "DELETE",
      headers: { host: PROD_HOST, referer: "not a url" },
    });
    expect(res.status).toBe(403);
  });

  test("/api/live POST is exempt (public liveness probe)", async () => {
    // The probe is normally GET-only, but mounting it as POST should still
    // not 403 — exemption is by path, not method.
    const app = new Hono<AppEnv>();
    app.use("*", originGuard);
    app.post("/api/live", (c) => c.text("live"));
    const res = await app.request("https://surety.hexly.ai/api/live", {
      method: "POST",
      headers: { host: PROD_HOST, origin: "https://evil.example" },
    });
    expect(res.status).toBe(200);
  });

  test("localhost dev host is exempt", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost:7016/api/things", {
      method: "POST",
      headers: { host: "localhost:7016", origin: "https://evil.example" },
      body: "{}",
    });
    expect(res.status).toBe(201);
  });

  test("E2E_SKIP_AUTH=true bypasses guard (non-prod environment)", async () => {
    const app = makeApp();
    const res = await app.request(
      "https://surety.hexly.ai/api/things",
      {
        method: "POST",
        headers: { host: PROD_HOST, origin: "https://evil.example" },
        body: "{}",
      },
      { E2E_SKIP_AUTH: "true", ENVIRONMENT: "test" },
    );
    expect(res.status).toBe(201);
  });

  test("E2E_SKIP_AUTH=true is ignored when ENVIRONMENT=production", async () => {
    const app = makeApp();
    const res = await app.request(
      "https://surety.hexly.ai/api/things",
      {
        method: "POST",
        headers: { host: PROD_HOST, origin: "https://evil.example" },
        body: "{}",
      },
      { E2E_SKIP_AUTH: "true", ENVIRONMENT: "production" },
    );
    expect(res.status).toBe(403);
  });

  test("spoofed Host: localhost on a CF edge request is NOT exempt", async () => {
    const app = makeApp();
    const req = new Request("https://surety.hexly.ai/api/things", {
      method: "POST",
      headers: { host: "localhost", origin: "https://evil.example" },
      body: "{}",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).cf = { colo: "SJC" };
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
  });
});
