/**
 * Middleware unit tests for the CF Worker auth stack.
 *
 * We mount each middleware on a throwaway Hono app and inspect the
 * context flags they set (accessAuthenticated, accessEmail) or the
 * response they emit.
 */
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { accessAuth } from "../src/middleware/access-auth";
import { apiKeyAuth } from "../src/middleware/api-key-auth";
import { isLocalhost } from "../src/middleware/is-localhost";
import type { AppEnv } from "../src/lib/types";

function makeApp(
  middleware: Parameters<Hono<AppEnv>["use"]>[1],
  repos?: unknown,
) {
  const app = new Hono<AppEnv>();
  if (repos !== undefined) {
    app.use("*", async (c, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      c.set("repos", repos as any);
      return next();
    });
  }
  app.use("*", middleware);
  app.get("/api/live", (c) => c.text("live"));
  app.get("/api/probe", (c) =>
    c.json({
      accessAuthenticated: c.get("accessAuthenticated") === true,
      accessEmail: c.get("accessEmail") ?? null,
    }),
  );
  return app;
}

describe("isLocalhost", () => {
  test("matches localhost, 127.0.0.1, *.dev.hexly.ai", () => {
    expect(isLocalhost("localhost")).toBe(true);
    expect(isLocalhost("localhost:7016")).toBe(true);
    expect(isLocalhost("127.0.0.1:7016")).toBe(true);
    expect(isLocalhost("app.dev.hexly.ai")).toBe(true);
  });

  test("rejects prod hostnames", () => {
    expect(isLocalhost("surety.hexly.ai")).toBe(false);
    expect(isLocalhost("example.com")).toBe(false);
    expect(isLocalhost("")).toBe(false);
  });
});

describe("accessAuth middleware", () => {
  test("skips /api/live entirely (no flag set)", async () => {
    const app = makeApp(accessAuth);
    const res = await app.request("/api/live", {
      headers: { host: "surety.hexly.ai" },
    });
    expect(res.status).toBe(200);
  });

  test("localhost host bypass sets accessAuthenticated=true", async () => {
    const app = makeApp(accessAuth);
    const res = await app.request("/api/probe", {
      headers: { host: "localhost:7016" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accessAuthenticated: boolean;
      accessEmail: string | null;
    };
    expect(body.accessAuthenticated).toBe(true);
    expect(body.accessEmail).toBeNull();
  });

  test("no CF_ACCESS config and not localhost → passthrough with no flag", async () => {
    const app = makeApp(accessAuth);
    const res = await app.request(
      "/api/probe",
      { headers: { host: "surety.hexly.ai" } },
      {},
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accessAuthenticated: boolean;
      accessEmail: string | null;
    };
    expect(body.accessAuthenticated).toBe(false);
    expect(body.accessEmail).toBeNull();
  });
});

describe("apiKeyAuth middleware", () => {
  test("allows /api/live without token", async () => {
    const app = makeApp(apiKeyAuth);
    const res = await app.request("/api/live", {
      headers: { host: "surety.hexly.ai" },
    });
    expect(res.status).toBe(200);
  });

  test("localhost host bypass allows anonymous requests", async () => {
    const app = makeApp(apiKeyAuth);
    const res = await app.request("/api/probe", {
      headers: { host: "127.0.0.1:7016" },
    });
    expect(res.status).toBe(200);
  });

  test("prod host with no auth → 401", async () => {
    const app = makeApp(apiKeyAuth, {
      apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
    });
    const res = await app.request("/api/probe", {
      headers: { host: "surety.hexly.ai" },
    });
    expect(res.status).toBe(401);
  });

  test("prod host with invalid Bearer token → 403", async () => {
    const app = makeApp(apiKeyAuth, {
      apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
    });
    const res = await app.request("/api/probe", {
      headers: {
        host: "surety.hexly.ai",
        authorization: "Bearer bad",
      },
    });
    expect(res.status).toBe(403);
  });

  test("prod host with valid Bearer token → passthrough", async () => {
    let lastUsedId = -1;
    const app = makeApp(apiKeyAuth, {
      apiTokens: {
        verify: async () => ({ id: 42, email: "alice@example.com" }),
        updateLastUsed: async (id: number) => {
          lastUsedId = id;
        },
      },
    });
    const res = await app.request("/api/probe", {
      headers: {
        host: "surety.hexly.ai",
        authorization: "Bearer sk_good",
      },
    });
    expect(res.status).toBe(200);
    // updateLastUsed is fire-and-forget; give it a tick to run
    await new Promise((r) => setTimeout(r, 10));
    expect(lastUsedId).toBe(42);
  });
});
