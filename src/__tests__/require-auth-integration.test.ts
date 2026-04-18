/**
 * Integration test: requireAuth() route-level behavior
 *
 * Verifies that the requireAuth() helper correctly returns
 * 401 Response for unauthenticated requests and AuthenticatedUser
 * for valid bearer tokens and sessions.
 *
 * Tests all three code paths:
 *   1. Test bypass (NODE_ENV=test) → auto-authenticated
 *   2. Bearer token → verified against apiTokens repo
 *   3. NextAuth session → verified via auth()
 *   4. No credentials → 401
 */

import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_BUN_ENV = process.env.BUN_ENV;
const ORIGINAL_E2E_SKIP = process.env.E2E_SKIP_AUTH;

// Track mock state
let mockAuthHeader: string | null = null;
let mockSessionEmail: string | null = null;
let mockVerifyResult: { email: string; id: number } | null = null;
// Mock next/headers
mock.module("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => {
      if (name === "authorization") return mockAuthHeader;
      return null;
    },
  }),
}));

// Mock next/server
mock.module("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => {
      return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
}));

// Mock auth
mock.module("@/auth", () => ({
  auth: async () => {
    if (mockSessionEmail) {
      return { user: { email: mockSessionEmail } };
    }
    return null;
  },
}));

// Mock api-helpers
mock.module("@/lib/api-helpers", () => ({
  getReposFromRequest: async () => ({
    repos: {
      apiTokens: {
        verify: async (_rawToken: string) => mockVerifyResult,
        updateLastUsed: async () => {
        },
      },
    },
  }),
}));

function disableTestBypass() {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = "production";
  delete env.BUN_ENV;
  delete env.E2E_SKIP_AUTH;
}

function restoreEnv() {
  const env = process.env as Record<string, string | undefined>;
  if (ORIGINAL_NODE_ENV === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_BUN_ENV === undefined) delete env.BUN_ENV;
  else env.BUN_ENV = ORIGINAL_BUN_ENV;
  if (ORIGINAL_E2E_SKIP === undefined) delete env.E2E_SKIP_AUTH;
  else env.E2E_SKIP_AUTH = ORIGINAL_E2E_SKIP;
}

describe("requireAuth() integration", () => {
  beforeEach(() => {
    mockAuthHeader = null;
    mockSessionEmail = null;
    mockVerifyResult = null;
  });

  afterEach(() => {
    restoreEnv();
  });

  test("test mode: auto-authenticates without checking DB", async () => {
    // NODE_ENV=test is already set by bun test
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth();

    // Should NOT be a Response (should be AuthenticatedUser)
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.email).toBe("test@example.com");
      expect(result.authMethod).toBe("session");
    }
  });

  test("valid bearer token: returns authenticated user", async () => {
    disableTestBypass();
    mockAuthHeader = "Bearer sk_valid_token_123";
    mockVerifyResult = { email: "cli-user@example.com", id: 42 };

    // Fresh import to pick up env changes
    delete require.cache[require.resolve("@/lib/api-auth")];
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth();

    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.email).toBe("cli-user@example.com");
      expect(result.authMethod).toBe("token");
    }
  });

  test("invalid bearer token: returns 401", async () => {
    disableTestBypass();
    mockAuthHeader = "Bearer sk_invalid_token";
    mockVerifyResult = null; // verify returns null

    delete require.cache[require.resolve("@/lib/api-auth")];
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth();

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
      const body = await result.json();
      expect(body.error).toBe("Unauthorized");
    }
  });

  test("no bearer token + valid session: falls through to session auth", async () => {
    disableTestBypass();
    mockAuthHeader = null; // no bearer
    mockSessionEmail = "web-user@example.com";

    delete require.cache[require.resolve("@/lib/api-auth")];
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth();

    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.email).toBe("web-user@example.com");
      expect(result.authMethod).toBe("session");
    }
  });

  test("no bearer token + no session: returns 401", async () => {
    disableTestBypass();
    mockAuthHeader = null;
    mockSessionEmail = null;

    delete require.cache[require.resolve("@/lib/api-auth")];
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth();

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });

  test("empty bearer token value: returns 401", async () => {
    disableTestBypass();
    mockAuthHeader = "Bearer ";
    mockVerifyResult = null;

    delete require.cache[require.resolve("@/lib/api-auth")];
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth();

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });

  test("bearer token does NOT fall through to session on invalid token", async () => {
    disableTestBypass();
    mockAuthHeader = "Bearer sk_bad_token";
    mockVerifyResult = null;
    mockSessionEmail = "should-not-use@example.com"; // session exists but should NOT be used

    delete require.cache[require.resolve("@/lib/api-auth")];
    const { requireAuth } = await import("@/lib/api-auth");
    const result = await requireAuth();

    // Must be 401 — invalid bearer token must not fall through to session
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });
});
