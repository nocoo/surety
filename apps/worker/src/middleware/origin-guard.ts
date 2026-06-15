import type { Context, Next } from "hono";
import type { AppEnv } from "../lib/types";
import { isLocalhost } from "./is-localhost";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hasBearer(c: Context<AppEnv>): boolean {
  return (c.req.header("Authorization") ?? "").startsWith("Bearer ");
}

function originFromHeaders(c: Context<AppEnv>): string | null {
  const origin = c.req.header("Origin");
  if (origin) return origin;
  const referer = c.req.header("Referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

function targetOrigin(c: Context<AppEnv>): string | null {
  const host = c.req.header("Host");
  if (!host) return null;
  let scheme: string;
  try {
    scheme = new URL(c.req.url).protocol.replace(":", "");
  } catch {
    return null;
  }
  return `${scheme}://${host}`;
}

/**
 * Same-origin guard for unsafe HTTP methods.
 *
 * Cloudflare Access JWTs and any future session cookies are auto-attached
 * by the browser on cross-site requests, so without an app-level Origin /
 * Referer check the Worker is implicitly CSRF-able. This middleware closes
 * that gap for state-changing methods.
 *
 * It only fires when ALL of these are true:
 *   - method is not GET / HEAD / OPTIONS,
 *   - the caller did NOT present `Authorization: Bearer ...`
 *     (Bearer-token API clients cannot be CSRF'd: CORS prevents arbitrary
 *     scripts from attaching an Authorization header to a cross-site fetch),
 *   - the request is not the public liveness probe,
 *   - the request is not a localhost / dev-host bypass,
 *   - E2E_SKIP_AUTH is not set in a non-prod environment.
 *
 * When it fires, Origin (or Referer as a fallback) must resolve to the same
 * scheme+host as the request itself. Missing or mismatched → 403.
 */
export async function originGuard(c: Context<AppEnv>, next: Next) {
  if (SAFE_METHODS.has(c.req.method)) return next();
  if (hasBearer(c)) return next();
  if (c.req.path === "/api/live") return next();
  if (isLocalhost(c)) return next();
  if (
    c.env?.E2E_SKIP_AUTH === "true" &&
    c.env?.ENVIRONMENT !== "production"
  ) {
    return next();
  }

  const requestOrigin = originFromHeaders(c);
  if (!requestOrigin) {
    return c.json(
      { error: "Origin or Referer header required" },
      403,
    );
  }
  const expected = targetOrigin(c);
  if (!expected || requestOrigin !== expected) {
    return c.json({ error: "Cross-origin request rejected" }, 403);
  }
  return next();
}
