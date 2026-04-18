/**
 * POST /api/settings/2fa/verify-setup
 * Verify the TOTP token to confirm 2FA setup.
 * On success: enables 2FA, revokes all existing API tokens, returns recovery code + nonce for JWT promotion.
 *
 * NOTE: No trusted-device cookie is issued here. The nonce-based JWT promotion
 * already exempts the current session. Trusted-device cookies should only be
 * issued during login verification with explicit user consent ("remember device").
 */
import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest, getSessionForApi } from "@/lib/api-helpers";
import { getTotpService } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionForApi();
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

  const { repos } = await getReposFromRequest();
  const totp = await getTotpService();

  // Already enabled?
  if (await totp.isEnabled()) {
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

  // Revoke all existing API tokens for this user.
  // CLI/programmatic access is not allowed for 2FA-enabled accounts.
  const revokedCount = await repos.apiTokens.revokeAllByEmail(session.user.email);

  return NextResponse.json({
    success: true,
    recoveryCode: result.recoveryCode,
    twoFactorNonce: result.nonce,
    twoFactorSig: result.nonceSig,
    revokedTokens: revokedCount,
  });
}
