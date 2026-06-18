/**
 * Coverage tests for the CF Access JWT verification branch in
 * `accessAuth`. Stubs `jose.jwtVerify` so we don't need a real
 * Cloudflare Access deployment.
 *
 * Behaviour under test: fail-CLOSED. On the CF Access-protected host
 * (`surety.hexly.ai`), every failure mode short-circuits with an error
 * response rather than falling through to apiKeyAuth.
 */
import { describe, expect, test, vi, afterAll } from "vitest";

let jwtResult: { ok: true; payload: Record<string, unknown> } | { ok: false };

vi.mock("jose", () => ({
  createRemoteJWKSet: () => () => ({}),
  jwtVerify: async () => {
    if (jwtResult.ok) {
      return { payload: jwtResult.payload, protectedHeader: {} };
    }
    throw new Error("invalid jwt");
  },
}));

afterAll(() => {
  vi.restoreAllMocks();
});

import { Hono } from "hono";
import { accessAuth } from "../src/middleware/access-auth";
import type { AppEnv } from "../src/lib/types";

function probeApp() {
  const app = new Hono<AppEnv>();
  app.use("*", accessAuth);
  app.get("/api/probe", (c) =>
    c.json({
      sessionAuthenticated: c.get("sessionAuthenticated") === true,
      accessAuthenticated: c.get("accessAuthenticated") === true,
      accessEmail: c.get("accessEmail") ?? null,
    }),
  );
  return app;
}

describe("accessAuth - CF JWT branch", () => {
  test("valid JWT with email payload sets session/access flags + email", async () => {
    jwtResult = { ok: true, payload: { email: "alice@hexly.ai" } };
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      {
        headers: {
          host: "surety.hexly.ai",
          "Cf-Access-Jwt-Assertion": "valid-jwt",
        },
      },
      {
        CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        CF_ACCESS_AUD: "aud-id",
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.sessionAuthenticated).toBe(true);
    expect(body.accessAuthenticated).toBe(true);
    expect(body.accessEmail).toBe("alice@hexly.ai");
  });

  test("valid JWT without email field still flags session, leaves email null", async () => {
    jwtResult = { ok: true, payload: { sub: "user_42" } };
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      {
        headers: {
          host: "surety.hexly.ai",
          "Cf-Access-Jwt-Assertion": "valid-no-email",
        },
      },
      {
        CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        CF_ACCESS_AUD: "aud-id",
      },
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.sessionAuthenticated).toBe(true);
    expect(body.accessEmail).toBeNull();
  });

  test("forged JWT (signature invalid) → 403 fail-closed", async () => {
    jwtResult = { ok: false };
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      {
        headers: {
          host: "surety.hexly.ai",
          "Cf-Access-Jwt-Assertion": "broken",
        },
      },
      {
        CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        CF_ACCESS_AUD: "aud-id",
      },
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  test("missing JWT header on prod host → 401 fail-closed", async () => {
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      { headers: { host: "surety.hexly.ai" } },
      {
        CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        CF_ACCESS_AUD: "aud-id",
      },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing/i);
  });

  test("CF_ACCESS env missing on prod host → 500 fail-closed", async () => {
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      {
        headers: {
          host: "surety.hexly.ai",
          "Cf-Access-Jwt-Assertion": "anything",
        },
      },
      {},
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/CF_ACCESS_TEAM_DOMAIN/);
  });

  test("CF_ACCESS partial env (team domain only) on prod host → 500 fail-closed", async () => {
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      {
        headers: {
          host: "surety.hexly.ai",
          "Cf-Access-Jwt-Assertion": "anything",
        },
      },
      { CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" },
    );
    expect(res.status).toBe(500);
  });

  test("localhost bypass still works (env unconfigured) — no fail-closed 500", async () => {
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      { headers: { host: "localhost:7016" } },
      {},
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessAuthenticated).toBe(true);
    expect(body.sessionAuthenticated).toBe(true);
  });

  test("/api/live whitelist still works (env unconfigured) — no fail-closed 500", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", accessAuth);
    app.get("/api/live", (c) => c.text("ok"));
    const res = await app.request(
      "/api/live",
      { headers: { host: "surety.hexly.ai" } },
      {},
    );
    expect(res.status).toBe(200);
  });

  test("machine endpoint (surety-api.hexly.ai) bypasses Access — apiKeyAuth handles it", async () => {
    // The CLI/bearer host shares the Worker with the browser host. accessAuth
    // must not 401 it for a missing JWT — apiKeyAuth gates that route.
    const app = probeApp();
    const res = await app.request(
      "/api/probe",
      { headers: { host: "surety-api.hexly.ai" } },
      {
        CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        CF_ACCESS_AUD: "aud-id",
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessAuthenticated).toBe(false);
    expect(body.sessionAuthenticated).toBe(false);
  });

  test("JWKS cache reused across requests for same team domain", async () => {
    jwtResult = { ok: true, payload: { email: "cached@hexly.ai" } };
    const app = probeApp();
    const env = {
      CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      CF_ACCESS_AUD: "aud-id",
    };
    for (let i = 0; i < 3; i++) {
      const res = await app.request(
        "/api/probe",
        {
          headers: {
            host: "surety.hexly.ai",
            "Cf-Access-Jwt-Assertion": "v",
          },
        },
        env,
      );
      expect(res.status).toBe(200);
    }
  });
});
