import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Skip auth in E2E test environment
const SKIP_AUTH = process.env.E2E_SKIP_AUTH === "true";

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
  // Skip auth check in E2E test environment
  if (SKIP_AUTH) {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;

  // Allow core auth routes (OAuth flow, NextAuth internals, CLI login).
  const isAuthRoute = pathname.startsWith("/api/auth/") && !pathname.startsWith("/api/auth/tokens");
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // Allow API requests with Bearer token — let route handler's requireAuth() validate the token.
  // This enables CLI/programmatic access without NextAuth session.
  // Security: proxy does NOT validate the token; invalid tokens will get 401 from requireAuth().
  const authHeader = req.headers.get("authorization");
  const isBearerRequest = authHeader?.toLowerCase().startsWith("bearer ");
  // Token management routes require session (already excluded from auth whitelist)
  const isSensitiveRoute = pathname.startsWith("/api/auth/tokens");
  if (pathname.startsWith("/api/") && isBearerRequest && !isSensitiveRoute) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");

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

  return NextResponse.next();
});

// Export as named 'proxy' function for Next.js 16
export function proxy(request: NextRequest) {
  return authHandler(request, {} as never);
}

export const config = {
  matcher: [
    // Match all paths except static files and health check
    // API routes ARE included (auth enforced at proxy level)
    // /api/auth/* and /api/live are allowed through in the handler above
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$|api/live).*)",
  ],
};
