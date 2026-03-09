import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Skip auth in E2E test environment
const SKIP_AUTH = process.env.E2E_SKIP_AUTH === "true";

// Database file mapping
const DATABASE_FILES: Record<string, string> = {
  production: "database/surety.db",
  example: "database/surety.example.db",
  test: "database/surety.e2e.db",
};

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

// Next.js 16 proxy convention (replaces middleware.ts)
// NextAuth's auth() returns a middleware-compatible handler
const authHandler = auth(async (req) => {
  // Read database selection from cookie and set environment variable
  const dbCookie = req.cookies.get("surety-database")?.value;
  if (dbCookie && DATABASE_FILES[dbCookie]) {
    process.env.SURETY_DB = DATABASE_FILES[dbCookie];
  }

  // Skip auth check in E2E test environment
  if (SKIP_AUTH) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const isLoginPage = pathname === "/login";
  const isAuthRoute = pathname.startsWith("/api/auth");
  const isVerify2FAPage = pathname === "/verify-2fa";
  const isVerify2FAApi = pathname === "/api/auth/verify-2fa";

  // Allow auth routes (OAuth flow + 2FA verification API)
  if (isAuthRoute || isVerify2FAApi) {
    return NextResponse.next();
  }

  // Redirect to home if logged in and trying to access login page
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(buildRedirectUrl(req, "/"));
  }

  // Not authenticated
  if (!isLoginPage && !isLoggedIn) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(buildRedirectUrl(req, "/login"));
  }

  // --- 2FA guard ---
  // Check if user needs 2FA verification
  if (isLoggedIn && !isVerify2FAPage) {
    const session = req.auth;
    const twoFactorVerified = session?.user?.twoFactorVerified;

    if (twoFactorVerified === false) {
      // Check trusted device cookie before redirecting
      const email = session?.user?.email;

      if (email) {
        try {
          const { getTotpService, TRUSTED_DEVICE_COOKIE_NAME } = await import("@/lib/totp");
          const trustedCookie = req.cookies.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;

          if (trustedCookie) {
            const totp = await getTotpService();
            if (totp.verifyTrustedCookie(trustedCookie, email)) {
              // Trusted device — allow through
              return NextResponse.next();
            }
          }
        } catch {
          // DB not available — can't validate trusted device
        }
      }

      // Not verified and not trusted
      if (isApiRoute) {
        return NextResponse.json({ error: "2FA verification required" }, { status: 403 });
      }
      return NextResponse.redirect(buildRedirectUrl(req, "/verify-2fa"));
    }
  }

  // If user is on /verify-2fa but already verified, redirect home
  if (isVerify2FAPage && isLoggedIn) {
    const session = req.auth;
    if (session?.user?.twoFactorVerified !== false) {
      return NextResponse.redirect(buildRedirectUrl(req, "/"));
    }
  }

  return NextResponse.next();
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
