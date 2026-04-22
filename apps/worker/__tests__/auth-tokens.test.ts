/**
 * Token-management routes are gated to interactive (CF Access) sessions.
 * A bearer/CLI token must NOT be able to enumerate or revoke tokens.
 */
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import authRoutes from "../src/routes/auth";
import { accessAuth } from "../src/middleware/access-auth";
import { apiKeyAuth } from "../src/middleware/api-key-auth";
import type { AppEnv } from "../src/lib/types";

interface TokenRow {
  id: number;
  email: string;
  name: string | null;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

const TOKENS: TokenRow[] = [
  {
    id: 1,
    email: "alice@hexly.ai",
    name: "alice cli",
    tokenPrefix: "sk_alice",
    createdAt: "2026-01-01",
    lastUsedAt: null,
    expiresAt: null,
  },
  {
    id: 2,
    email: "bob@hexly.ai",
    name: "bob cli",
    tokenPrefix: "sk_bob",
    createdAt: "2026-01-02",
    lastUsedAt: null,
    expiresAt: null,
  },
];

function buildRepos(verifyEmail: string | null) {
  let lastRevokedId: number | null = null;
  const repos = {
    apiTokens: {
      verify: async () =>
        verifyEmail ? { id: 99, email: verifyEmail } : null,
      updateLastUsed: async () => {},
      listAll: async () => TOKENS,
      listByEmail: async (email: string) =>
        TOKENS.filter((t) => t.email === email),
      findById: async (id: number) => TOKENS.find((t) => t.id === id),
      revoke: async (id: number) => {
        lastRevokedId = id;
        return TOKENS.some((t) => t.id === id);
      },
    },
    get lastRevokedId() {
      return lastRevokedId;
    },
  };
  return repos;
}

function buildApp(repos: ReturnType<typeof buildRepos>) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set("repos", repos as any);
    return next();
  });
  app.use("*", accessAuth);
  app.use("*", apiKeyAuth);
  app.route("/", authRoutes);
  return app;
}

describe("GET /api/auth/tokens", () => {
  test("rejects bearer-only auth (CLI token)", async () => {
    const repos = buildRepos("alice@hexly.ai");
    const app = buildApp(repos);
    const res = await app.request(
      "/api/auth/tokens",
      {
        headers: {
          host: "surety.hexly.ai",
          authorization: "Bearer sk_alice",
        },
      },
      {},
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Session");
  });

  test("interactive session sees only its own tokens", async () => {
    const repos = buildRepos(null);
    // localhost dev bypass with no bearer → sessionAuthenticated=true,
    // accessEmail unset (no scoping), but we need an email to test scoping
    // — emulate a CF-Access session by injecting accessEmail upstream.
    const upstream = new Hono<AppEnv>();
    upstream.use("*", async (c, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      c.set("repos", repos as any);
      c.set("sessionAuthenticated", true);
      c.set("accessAuthenticated", true);
      c.set("accessEmail", "alice@hexly.ai");
      return next();
    });
    upstream.route("/", authRoutes);
    const res = await upstream.request("/api/auth/tokens", {}, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: number }>;
    expect(body.map((t) => t.id)).toEqual([1]);
  });

  test("localhost dev session (no email) sees all tokens", async () => {
    const repos = buildRepos(null);
    const app = buildApp(repos);
    const res = await app.request(
      "/api/auth/tokens",
      { headers: { host: "localhost:7016" } },
      {},
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: number }>;
    expect(body.map((t) => t.id).sort()).toEqual([1, 2]);
  });
});

describe("DELETE /api/auth/tokens/:id", () => {
  test("rejects bearer-only auth", async () => {
    const repos = buildRepos("alice@hexly.ai");
    const app = buildApp(repos);
    const res = await app.request(
      "/api/auth/tokens/2",
      {
        method: "DELETE",
        headers: {
          host: "surety.hexly.ai",
          authorization: "Bearer sk_alice",
        },
      },
      {},
    );
    expect(res.status).toBe(401);
    expect(repos.lastRevokedId).toBeNull();
  });

  test("session user cannot revoke another user's token", async () => {
    const repos = buildRepos(null);
    const upstream = new Hono<AppEnv>();
    upstream.use("*", async (c, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      c.set("repos", repos as any);
      c.set("sessionAuthenticated", true);
      c.set("accessAuthenticated", true);
      c.set("accessEmail", "alice@hexly.ai");
      return next();
    });
    upstream.route("/", authRoutes);
    const res = await upstream.request(
      "/api/auth/tokens/2",
      { method: "DELETE" },
      {},
    );
    expect(res.status).toBe(404);
    expect(repos.lastRevokedId).toBeNull();
  });

  test("session user can revoke their own token", async () => {
    const repos = buildRepos(null);
    const upstream = new Hono<AppEnv>();
    upstream.use("*", async (c, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      c.set("repos", repos as any);
      c.set("sessionAuthenticated", true);
      c.set("accessAuthenticated", true);
      c.set("accessEmail", "alice@hexly.ai");
      return next();
    });
    upstream.route("/", authRoutes);
    const res = await upstream.request(
      "/api/auth/tokens/1",
      { method: "DELETE" },
      {},
    );
    expect(res.status).toBe(200);
    expect(repos.lastRevokedId).toBe(1);
  });
});
