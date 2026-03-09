/**
 * POST /api/auth/verify-2fa
 * Verify TOTP token or recovery code during login.
 * On success: returns nonce for JWT update and sets trusted device cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { getTotpService, TRUSTED_DEVICE_COOKIE_NAME, TRUSTED_DEVICE_MAX_AGE } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const token = body.token as string | undefined;
  const type = (body.type as string) || "totp"; // "totp" or "recovery"
  const rememberDevice = body.rememberDevice !== false; // default true

  await ensureDbFromRequest();
  const totp = await getTotpService();

  // Check 2FA is enabled
  if (!totp.isEnabled()) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  // --- Validate input ---
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  if (type === "totp" && !/^\d{6}$/.test(token)) {
    return NextResponse.json(
      { error: "A 6-digit code is required" },
      { status: 400 },
    );
  }

  // Delegate to service
  const result = await totp.verifyLogin(token, session.user.email, type as "totp" | "recovery");

  if ("error" in result) {
    const status = "locked" in result && result.locked ? 429 : 401;
    return NextResponse.json({ error: result.error }, { status });
  }

  // --- Success ---
  const response = NextResponse.json({
    success: true,
    twoFactorNonce: result.nonce,
    twoFactorSig: result.nonceSig,
  });

  if (rememberDevice) {
    const cookieValue = totp.createTrustedCookieValue(session.user.email);
    response.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production" ||
        process.env.USE_SECURE_COOKIES === "true" ||
        (process.env.NEXTAUTH_URL?.startsWith("https://") ?? false),
      maxAge: TRUSTED_DEVICE_MAX_AGE,
    });
  }

  return response;
}
