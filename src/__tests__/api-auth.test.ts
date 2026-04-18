/**
 * Unit tests for src/lib/api-auth.ts.
 *
 * authenticateRequest() has three branches:
 *   1. Test/E2E bypass — short-circuits before touching headers/db.
 *   2. Bearer token path — headers().get('authorization') + repos.apiTokens.verify().
 *   3. NextAuth session fallback — auth().
 *
 * We exercise (2) and (3) by clearing the test bypass env vars, mocking
 * next/headers + @/auth + getReposFromRequest, and importing the SUT fresh
 * each time.
 */
import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_BUN_ENV = process.env.BUN_ENV;
const ORIGINAL_E2E_SKIP = process.env.E2E_SKIP_AUTH;

function disableTestBypass() {
  // The bypass key off NODE_ENV/BUN_ENV/E2E_SKIP_AUTH; clear all of them.
  // @ts-expect-error — overriding the readonly NodeJS.ProcessEnv typing
  process.env.NODE_ENV = "production";
  delete process.env.BUN_ENV;
  delete process.env.E2E_SKIP_AUTH;
}

function restoreEnv() {
  // Cast through unknown to write back into the readonly NodeJS.ProcessEnv typing
  const env = process.env as Record<string, string | undefined>;
  if (ORIGINAL_NODE_ENV === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_BUN_ENV === undefined) delete env.BUN_ENV;
  else env.BUN_ENV = ORIGINAL_BUN_ENV;
  if (ORIGINAL_E2E_SKIP === undefined) delete env.E2E_SKIP_AUTH;
  else env.E2E_SKIP_AUTH = ORIGINAL_E2E_SKIP;
}

// --- Mocks ---

let authHeader: string | null = null;
let sessionEmail: string | null = null;

const verifyMock = mock(
  (_t: string): Promise<{ email: string; id: number } | null> =>
    Promise.resolve(null),
);
const updateLastUsedMock = mock((_id: number) => Promise.resolve());

mock.module("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === "authorization" ? authHeader : null,
  }),
}));

mock.module("@/auth", () => ({
  auth: async () =>
    sessionEmail ? { user: { email: sessionEmail } } : null,
}));

mock.module("@/lib/api-helpers", () => ({
  getReposFromRequest: async () => ({
    repos: {
      apiTokens: {
        verify: verifyMock,
        updateLastUsed: updateLastUsedMock,
      },
    },
  }),
}));

const { authenticateRequest, requireAuth } = await import("@/lib/api-auth");

describe("api-auth", () => {
  beforeEach(() => {
    authHeader = null;
    sessionEmail = null;
    verifyMock.mockReset();
    updateLastUsedMock.mockReset();
    verifyMock.mockImplementation(() => Promise.resolve(null));
    updateLastUsedMock.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    restoreEnv();
  });

  test("test bypass: returns synthetic user when BUN_ENV=test (default)", async () => {
    process.env.BUN_ENV = "test";
    const result = await authenticateRequest();
    expect(result).toEqual({ email: "test@example.com", authMethod: "session" });
  });

  test("bearer token: returns token user when verify succeeds", async () => {
    disableTestBypass();
    authHeader = "Bearer sk_abc";
    verifyMock.mockImplementation((t: string) =>
      Promise.resolve(t === "sk_abc" ? { email: "alice@example.com", id: 7 } : null),
    );

    const result = await authenticateRequest();
    expect(result).toEqual({ email: "alice@example.com", authMethod: "token" });
    // updateLastUsed is fired but not awaited — wait a tick so we can assert.
    await new Promise((r) => setTimeout(r, 5));
    expect(updateLastUsedMock).toHaveBeenCalledWith(7);
  });

  test("bearer token: lowercase scheme is accepted", async () => {
    disableTestBypass();
    authHeader = "bearer sk_lower";
    verifyMock.mockImplementation(() =>
      Promise.resolve({ email: "alice@example.com", id: 1 }),
    );
    const result = await authenticateRequest();
    expect(result?.authMethod).toBe("token");
  });

  test("bearer token: returns null for unknown token (no session fallback)", async () => {
    disableTestBypass();
    authHeader = "Bearer sk_bad";
    sessionEmail = "alice@example.com"; // would otherwise authenticate
    verifyMock.mockImplementation(() => Promise.resolve(null));
    const result = await authenticateRequest();
    expect(result).toBeNull();
  });

  test("bearer token: empty token returns null", async () => {
    disableTestBypass();
    authHeader = "Bearer ";
    const result = await authenticateRequest();
    expect(result).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  test("session fallback: returns session user when no bearer header", async () => {
    disableTestBypass();
    sessionEmail = "bob@example.com";
    const result = await authenticateRequest();
    expect(result).toEqual({ email: "bob@example.com", authMethod: "session" });
  });

  test("returns null when neither bearer nor session present", async () => {
    disableTestBypass();
    const result = await authenticateRequest();
    expect(result).toBeNull();
  });

  test("requireAuth returns 401 Response when unauthenticated", async () => {
    disableTestBypass();
    const result = await requireAuth();
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
      const body = await result.json();
      expect(body).toEqual({ error: "Unauthorized" });
    }
  });

  test("requireAuth returns user when authenticated", async () => {
    disableTestBypass();
    sessionEmail = "carol@example.com";
    const result = await requireAuth();
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.email).toBe("carol@example.com");
    }
  });
});
