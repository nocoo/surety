import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveProxyAction, checkTrustedDevice, type ProxyAction } from "@/lib/proxy-logic";

// Skip auth in E2E test environment
const SKIP_AUTH = process.env.E2E_SKIP_AUTH === "true";

// Database file mapping is no longer needed — request-scoped DB routing
// via cookie handled by getDbForRequest() in api-helpers.ts

// Build redirect URL respecting reverse proxy headers
function buildRedirectUrl(req: NextRequest, pathname: string): URL {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    // Use forwarded host from reverse proxy
    return new URL(pathname, `${forwardedProto}://${forwardedHost}`);
  }

  // Fallback to request URL
  return new URL(pathname, req.nextUrl.origin);
}

/**
 * Check if the request carries a valid trusted-device cookie for the given email.
 * Returns true if the device is trusted and 2FA can be skipped for this request.
 *
 * NOTE: This is a request-scoped check (cookie), NOT a session-level state.
 * session.user.twoFactorVerified tracks explicit nonce promotion only.
 * Effective 2FA satisfied = twoFactorVerified || isTrustedDevice.
 * Proxy is the enforcement point for access control.
 */
async function isTrustedDevice(req: NextRequest, email: string): Promise<boolean> {
  try {
    const { getTotpService, TRUSTED_DEVICE_COOKIE_NAME } = await import("@/lib/totp");
    const cookieValue = req.cookies.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;

    const totp = await getTotpService();
    return checkTrustedDevice(cookieValue, email, (cv, em) => totp.verifyTrustedCookie(cv, em));
  } catch {
    // DB not available — can't validate trusted device
    return false;
  }
}

/** Convert a ProxyAction into a NextResponse */
function actionToResponse(action: ProxyAction, req: NextRequest): NextResponse {
  switch (action.type) {
    case "next":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(buildRedirectUrl(req, action.to));
    case "json":
      if (action.status === 401) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json({ error: "2FA verification required" }, { status: 403 });
  }
}

// Next.js 16 proxy convention (replaces middleware.ts)
// NextAuth's auth() returns a middleware-compatible handler
const authHandler = auth(async (req) => {
  // Database selection is now request-scoped via cookie, no global state needed

  // Skip auth check in E2E test environment
  if (SKIP_AUTH) {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;

  // Allow auth routes (OAuth flow + 2FA verification API) — pre-filter before decision logic
  if (pathname.startsWith("/api/auth") || pathname === "/api/auth/verify-2fa") {
    return NextResponse.next();
  }

  // API requests carrying a Bearer token are authenticated at the route level
  // by authenticateRequest(). The proxy should not reject them based on the
  // absence of a NextAuth session cookie, and 2FA does not apply to programmatic
  // CLI access — let the route handler verify the token.
  if (pathname.startsWith("/api/")) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      return NextResponse.next();
    }
  }

  const isLoggedIn = !!req.auth;
  const session = req.auth;
  const twoFactorVerified = session?.user?.twoFactorVerified;

  // Resolve trusted device status and DB 2FA state when needed
  let isTrusted = false;
  let twoFactorEnabled = true; // fail closed by default
  if (isLoggedIn && twoFactorVerified === false) {
    const email = session?.user?.email;
    isTrusted = email ? await isTrustedDevice(req, email) : false;

    // Check DB truth: 2FA may have been disabled since login (JWT stale)
    try {
      const { getTotpService } = await import("@/lib/totp");
      const totp = await getTotpService();
      twoFactorEnabled = await totp.isEnabled();
    } catch {
      // DB unavailable — fail closed (assume 2FA still enabled)
    }
  }

  const action = resolveProxyAction({ isLoggedIn, pathname, twoFactorVerified, isTrusted, twoFactorEnabled });
  return actionToResponse(action, req);
});

// Export as named 'proxy' function for Next.js 16
export function proxy(request: NextRequest) {
  return authHandler(request, {} as never);
}

export const config = {
  matcher: [
    // Match all paths except static files and health check
    // API routes ARE included (auth/2FA enforced at proxy level)
    // /api/auth/* and /api/live are allowed through in the handler above
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$|api/live).*)",
  ],
};
