/**
 * Unit tests for the CLI auth endpoints:
 *   GET  /api/auth/cli           — mints a token and redirects back to localhost
 *   GET  /api/auth/tokens         — lists the caller's tokens
 *   DELETE /api/auth/tokens/[id]  — revokes a token (owner only)
 *
 * The route handlers depend on @/auth (NextAuth session) and @/lib/api-helpers
 * (request-scoped repos). Both are mocked.
 */
import { describe, expect, test, beforeEach, mock } from "bun:test";
import type { NextRequest } from "next/server";

let sessionEmail: string | null = "alice@example.com";

const tokensCreate = mock(
  (_email: string, _name?: string) =>
    Promise.resolve({ token: "sk_freshly_minted", id: 1, tokenPrefix: "sk_fresh" }),
);
const tokensListByEmail = mock((_email: string) =>
  Promise.resolve<Array<Record<string, unknown>>>([]),
);
const tokensFindById = mock((_id: number) =>
  Promise.resolve<Record<string, unknown> | undefined>(undefined),
);
const tokensRevoke = mock((_id: number) => Promise.resolve(true));

mock.module("@/auth", () => ({
  auth: async () => (sessionEmail ? { user: { email: sessionEmail } } : null),
  signIn: async (_provider: string, opts: { redirectTo: string }) =>
    new Response(null, { status: 302, headers: { location: opts.redirectTo } }),
}));

mock.module("@/lib/api-helpers", () => ({
  getReposFromRequest: async () => ({
    repos: {
      apiTokens: {
        create: tokensCreate,
        listByEmail: tokensListByEmail,
        findById: tokensFindById,
        revoke: tokensRevoke,
      },
    },
  }),
}));

const cli = await import("@/app/api/auth/cli/route");
const tokensRoute = await import("@/app/api/auth/tokens/route");
const tokenIdRoute = await import("@/app/api/auth/tokens/[id]/route");

function reqFor(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  sessionEmail = "alice@example.com";
  tokensCreate.mockReset();
  tokensListByEmail.mockReset();
  tokensFindById.mockReset();
  tokensRevoke.mockReset();
  tokensCreate.mockImplementation(() =>
    Promise.resolve({ token: "sk_freshly_minted", id: 1, tokenPrefix: "sk_fresh" }),
  );
  tokensListByEmail.mockImplementation(() => Promise.resolve([]));
  tokensFindById.mockImplementation(() => Promise.resolve(undefined));
  tokensRevoke.mockImplementation(() => Promise.resolve(true));
});

describe("isLocalhostUrl", () => {
  test("accepts http://127.0.0.1:* and http://localhost:*", () => {
    expect(cli.isLocalhostUrl("http://127.0.0.1:5173/cb")).toBe(true);
    expect(cli.isLocalhostUrl("http://localhost:8080/cb")).toBe(true);
  });

  test("rejects https / non-loopback hosts / malformed input", () => {
    expect(cli.isLocalhostUrl("https://127.0.0.1:5173/cb")).toBe(false);
    expect(cli.isLocalhostUrl("http://example.com/cb")).toBe(false);
    expect(cli.isLocalhostUrl("not a url")).toBe(false);
    // Tricky: loopback-looking userinfo segment must not bypass the check.
    expect(cli.isLocalhostUrl("http://127.0.0.1@evil.com/cb")).toBe(false);
  });
});

describe("GET /api/auth/cli", () => {
  test("400 when callback_url missing", async () => {
    const res = await cli.GET(reqFor("https://surety.test/api/auth/cli"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "callback_url is required" });
  });

  test("400 when callback_url is not localhost", async () => {
    const res = await cli.GET(
      reqFor(
        "https://surety.test/api/auth/cli?callback_url=https://evil.com/cb",
      ),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "callback_url must be a localhost URL",
    });
  });

  test("redirects through OAuth when no session present", async () => {
    sessionEmail = null;
    const res = await cli.GET(
      reqFor(
        "https://surety.test/api/auth/cli?callback_url=http://127.0.0.1:1/cb&state=xyz",
      ),
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toContain("/api/auth/cli");
    expect(loc).toContain("callback_url=http%3A%2F%2F127.0.0.1%3A1%2Fcb");
    expect(loc).toContain("state=xyz");
    expect(tokensCreate).not.toHaveBeenCalled();
  });

  test("mints a token and redirects to callback_url with api_key/state/email", async () => {
    sessionEmail = "alice@example.com";
    const res = await cli.GET(
      reqFor(
        "https://surety.test/api/auth/cli?callback_url=http://127.0.0.1:1/cb&state=xyz",
      ),
    );
    expect(tokensCreate).toHaveBeenCalledWith("alice@example.com", "CLI");
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    if (!location) throw new Error("missing redirect location");
    const loc = new URL(location);
    expect(loc.origin).toBe("http://127.0.0.1:1");
    expect(loc.pathname).toBe("/cb");
    expect(loc.searchParams.get("api_key")).toBe("sk_freshly_minted");
    expect(loc.searchParams.get("state")).toBe("xyz");
    expect(loc.searchParams.get("email")).toBe("alice@example.com");
  });

  test("omits state when none was provided", async () => {
    sessionEmail = "alice@example.com";
    const res = await cli.GET(
      reqFor(
        "https://surety.test/api/auth/cli?callback_url=http://localhost:9/cb",
      ),
    );
    const location = res.headers.get("location");
    if (!location) throw new Error("missing redirect location");
    const loc = new URL(location);
    expect(loc.searchParams.has("state")).toBe(false);
    expect(loc.searchParams.get("api_key")).toBe("sk_freshly_minted");
  });
});

describe("GET /api/auth/tokens", () => {
  test("401 when no session", async () => {
    sessionEmail = null;
    const res = await tokensRoute.GET();
    expect(res.status).toBe(401);
  });

  test("returns tokens for the authenticated email, no raw token field", async () => {
    tokensListByEmail.mockImplementation(() =>
      Promise.resolve([
        {
          id: 1,
          name: "laptop",
          tokenPrefix: "sk_abc12",
          createdAt: "2026-04-01T00:00:00Z",
          lastUsedAt: null,
          expiresAt: null,
          token: "should-not-leak",
          email: "alice@example.com",
        },
      ]),
    );
    const res = await tokensRoute.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(tokensListByEmail).toHaveBeenCalledWith("alice@example.com");
    expect(body).toEqual([
      {
        id: 1,
        name: "laptop",
        tokenPrefix: "sk_abc12",
        createdAt: "2026-04-01T00:00:00Z",
        lastUsedAt: null,
        expiresAt: null,
      },
    ]);
  });
});

describe("DELETE /api/auth/tokens/[id]", () => {
  test("401 when no session", async () => {
    sessionEmail = null;
    const res = await tokenIdRoute.DELETE(reqFor("https://x/"), ctx("1"));
    expect(res.status).toBe(401);
  });

  test("400 when id is not a number", async () => {
    const res = await tokenIdRoute.DELETE(reqFor("https://x/"), ctx("abc"));
    expect(res.status).toBe(400);
  });

  test("404 when token belongs to another user", async () => {
    tokensFindById.mockImplementation(() =>
      Promise.resolve({ id: 5, email: "bob@example.com" }),
    );
    const res = await tokenIdRoute.DELETE(reqFor("https://x/"), ctx("5"));
    expect(res.status).toBe(404);
    expect(tokensRevoke).not.toHaveBeenCalled();
  });

  test("404 when token does not exist at all", async () => {
    tokensFindById.mockImplementation(() => Promise.resolve(undefined));
    const res = await tokenIdRoute.DELETE(reqFor("https://x/"), ctx("9"));
    expect(res.status).toBe(404);
    expect(tokensRevoke).not.toHaveBeenCalled();
  });

  test("revokes the token when caller owns it", async () => {
    tokensFindById.mockImplementation(() =>
      Promise.resolve({ id: 5, email: "alice@example.com" }),
    );
    const res = await tokenIdRoute.DELETE(reqFor("https://x/"), ctx("5"));
    expect(res.status).toBe(200);
    expect(tokensRevoke).toHaveBeenCalledWith(5);
    expect(await res.json()).toEqual({ success: true });
  });

  test("returns 404 if revoke unexpectedly returns false", async () => {
    tokensFindById.mockImplementation(() =>
      Promise.resolve({ id: 5, email: "alice@example.com" }),
    );
    tokensRevoke.mockImplementation(() => Promise.resolve(false));
    const res = await tokenIdRoute.DELETE(reqFor("https://x/"), ctx("5"));
    expect(res.status).toBe(404);
  });
});
