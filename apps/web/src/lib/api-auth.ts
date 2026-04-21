/**
 * Unified authentication for App Router API routes.
 *
 * Supports two methods, in order:
 *   1. `Authorization: Bearer <token>` — checked against the api_tokens table.
 *   2. NextAuth session cookie — used when no bearer token is present (web UI).
 *
 * The route does not need to know which method authenticated the caller; for
 * authorization decisions both are treated as "the user identified by email".
 */

import type { AuthenticatedUser } from "./api-auth-types";
import { getReposFromRequest } from "./api-helpers";

export type { AuthenticatedUser } from "./api-auth-types";

/**
 * Authenticate a request via bearer token OR NextAuth session.
 * Returns the authenticated user, or null if neither method succeeded.
 *
 * Bearer tokens take precedence over session: a request that explicitly sends
 * a (potentially invalid) bearer token must NOT silently fall back to a
 * lingering browser session.
 */
export async function authenticateRequest(): Promise<AuthenticatedUser | null> {
  // Test / E2E bypass: existing unit tests and the E2E runner do not exercise
  // the auth layer; gate it behind the same flags that other request-scoped
  // helpers (db/index.ts) already honor so adding bearer auth does not require
  // touching every existing test.
  if (
    process.env.E2E_SKIP_AUTH === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.BUN_ENV === "test"
  ) {
    return { email: "test@example.com", authMethod: "session" };
  }

  // 1. Bearer token
  const { headers } = await import("next/headers");
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    if (!rawToken) return null;
    const { repos } = await getReposFromRequest();
    const result = await repos.apiTokens.verify(rawToken);
    if (!result) return null;
    // Update lastUsedAt asynchronously; do not block the request on this.
    repos.apiTokens.updateLastUsed(result.id).catch(() => {});
    return { email: result.email, authMethod: "token" };
  }

  // 2. NextAuth session
  const { auth } = await import("@/auth");
  const session = await auth();
  if (session?.user?.email) {
    return { email: session.user.email, authMethod: "session" };
  }

  return null;
}

/**
 * Helper for route handlers: returns the authenticated user or a 401 Response.
 * Usage:
 *
 *   const auth = await requireAuth();
 *   if (auth instanceof Response) return auth;
 *   // ... use auth.email
 */
export async function requireAuth(): Promise<AuthenticatedUser | Response> {
  const user = await authenticateRequest();
  if (!user) {
    const { NextResponse } = await import("next/server");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}
