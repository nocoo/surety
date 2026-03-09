/**
 * POST /api/settings/2fa/verify-setup
 * Verify the TOTP token to confirm 2FA setup.
 * On success: enables 2FA, returns recovery code + nonce for JWT promotion,
 * and issues a trusted-device cookie (user proved authenticator ownership).
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

  if (!token || !/^\d{6}$/.test(token)) {
    return NextResponse.json(
      { error: "A 6-digit code is required" },
      { status: 400 },
    );
  }

  await ensureDbFromRequest();
  const totp = await getTotpService();

  // Already enabled?
  if (totp.isEnabled()) {
    return NextResponse.json(
      { error: "2FA is already enabled" },
      { status: 409 },
    );
  }

  const result = await totp.verifySetup(token, session.user.email);

  if ("error" in result) {
    const status = "locked" in result && result.locked ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  // Setup proves authenticator ownership — issue trusted-device cookie
  // so the user is exempted from 2FA on next login (within trust window).
  const response = NextResponse.json({
    success: true,
    recoveryCode: result.recoveryCode,
    twoFactorNonce: result.nonce,
    twoFactorSig: result.nonceSig,
  });

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

  return response;
}
