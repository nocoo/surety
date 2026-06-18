/**
 * L2 E2E — auth/token surfaces wired against the real apiTokens repo on
 * an in-memory DB. Verifies that token creation, listing, and revocation
 * work end-to-end with both bearer and session-flavored requests.
 */
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { buildTestApp, jsonRequest } from "./setup";
import authRoutes from "../../src/routes/auth";
import authCliRoutes from "../../src/routes/auth-cli";
import type { AppEnv } from "../../src/lib/types";

describe("L2 E2E: auth-cli token mint", () => {
  test("missing callback_url → 400", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(env, "GET", "/api/auth/cli");
    expect(r.status).toBe(400);
  });

  test("non-localhost callback_url → 400", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(
      env,
      "GET",
      "/api/auth/cli?callback_url=https://evil.test/cb",
    );
    expect(r.status).toBe(400);
  });

  test("missing accessEmail → 400", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(
      env,
      "GET",
      "/api/auth/cli?callback_url=http://127.0.0.1:9999/cb",
    );
    expect(r.status).toBe(400);
  });

  test("with session email → 302 redirect with api_key", async () => {
    const env = buildTestApp();
    // Mount a probe app that injects accessEmail upstream.
    const probe = new Hono<AppEnv>();
    probe.use("*", async (c, next) => {
      c.set("repos", env.repos);
      c.set("accessAuthenticated", true);
      c.set("sessionAuthenticated", true);
      c.set("accessEmail", "owner@hexly.ai");
      return next();
    });
    probe.route("/", authCliRoutes);
    const res = await probe.request(
      "/api/auth/cli?callback_url=http://127.0.0.1:9876/cb&state=xyz",
      {
        headers: {
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
          "sec-fetch-site": "none",
        },
      },
      env.bindings,
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith("http://127.0.0.1:9876/cb")).toBe(true);
    expect(loc).toContain("api_key=sk_");
    expect(loc).toContain("state=xyz");
    expect(loc).toContain("email=owner%40hexly.ai");
  });
});

describe("L2 E2E: auth tokens management", () => {
  test("session user lists own tokens after minting", async () => {
    const env = buildTestApp();

    // Mint two tokens for alice, one for bob — directly through the repo.
    await env.repos.apiTokens.create("alice@hexly.ai", "alice cli");
    await env.repos.apiTokens.create("alice@hexly.ai", "alice cli 2");
    await env.repos.apiTokens.create("bob@hexly.ai", "bob cli");

    const probe = new Hono<AppEnv>();
    probe.use("*", async (c, next) => {
      c.set("repos", env.repos);
      c.set("accessAuthenticated", true);
      c.set("sessionAuthenticated", true);
      c.set("accessEmail", "alice@hexly.ai");
      return next();
    });
    probe.route("/", authRoutes);

    const res = await probe.request("/api/auth/tokens", {}, env.bindings);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: number; tokenPrefix: string }>;
    expect(body.length).toBe(2);
  });

  test("non-session bearer-only request rejected", async () => {
    const env = buildTestApp();
    await env.repos.apiTokens.create("alice@hexly.ai", "alice cli");
    const r = await jsonRequest(env, "GET", "/api/auth/tokens");
    // E2E_SKIP_AUTH bypasses api-key-auth, but session check still runs
    expect(r.status).toBe(401);
  });

  test("session user can revoke own token; not others'", async () => {
    const env = buildTestApp();
    const aliceTok = await env.repos.apiTokens.create("alice@hexly.ai", "a");
    const bobTok = await env.repos.apiTokens.create("bob@hexly.ai", "b");

    const probe = new Hono<AppEnv>();
    probe.use("*", async (c, next) => {
      c.set("repos", env.repos);
      c.set("accessAuthenticated", true);
      c.set("sessionAuthenticated", true);
      c.set("accessEmail", "alice@hexly.ai");
      return next();
    });
    probe.route("/", authRoutes);

    const denied = await probe.request(
      `/api/auth/tokens/${bobTok.id}`,
      { method: "DELETE" },
      env.bindings,
    );
    expect(denied.status).toBe(404);

    const ok = await probe.request(
      `/api/auth/tokens/${aliceTok.id}`,
      { method: "DELETE" },
      env.bindings,
    );
    expect(ok.status).toBe(200);
  });
});
