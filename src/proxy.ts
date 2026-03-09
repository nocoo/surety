import { auth } from "@/auth";
import { verifyTrustedDeviceCookie, TRUSTED_DEVICE_COOKIE_NAME, TOTP_SETTINGS_KEYS } from "@/lib/totp";
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
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isVerify2FAPage = req.nextUrl.pathname === "/verify-2fa";
  const isVerify2FAApi = req.nextUrl.pathname === "/api/auth/verify-2fa";

  // Allow auth routes (OAuth flow + 2FA verification API)
  if (isAuthRoute || isVerify2FAApi) {
    return NextResponse.next();
  }

  // Redirect to home if logged in and trying to access login page
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(buildRedirectUrl(req, "/"));
  }

  // Redirect to login if not logged in and trying to access protected page
  if (!isLoginPage && !isLoggedIn) {
    return NextResponse.redirect(buildRedirectUrl(req, "/login"));
  }

  // --- 2FA guard ---
  // Check if user needs 2FA verification
  if (isLoggedIn && !isVerify2FAPage) {
    const session = req.auth;
    const twoFactorVerified = session?.user?.twoFactorVerified;

    if (twoFactorVerified === false) {
      // Check trusted device cookie before redirecting
      const trustedCookie = req.cookies.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
      const email = session?.user?.email;

      if (trustedCookie && email) {
        // Get current enrollment version for cookie validation
        let enrollVersion: string | undefined;
        try {
          const { settingsRepo } = await import("@/db/repositories/settings");
          enrollVersion = settingsRepo.get(TOTP_SETTINGS_KEYS.enrollVersion) ?? "1";
        } catch {
          // DB not available — can't validate enrollment version
        }

        if (verifyTrustedDeviceCookie(trustedCookie, email, enrollVersion)) {
          // Trusted device — allow through
          return NextResponse.next();
        }
      }

      // Not verified and not trusted — redirect to 2FA page
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
    // Match all paths except static files and api routes (except auth)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$|api/(?!auth)).*)",
  ],
};
