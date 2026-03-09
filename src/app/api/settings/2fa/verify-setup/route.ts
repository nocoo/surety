/**
 * POST /api/settings/2fa/verify-setup
 * Verify the TOTP token to confirm 2FA setup.
 * On success: enables 2FA and returns recovery code.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import {
  decryptSecret,
  verifyToken,
  generateRecoveryCode,
  hashRecoveryCode,
  TOTP_SETTINGS_KEYS,
} from "@/lib/totp";

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
  const { settingsRepo } = await import("@/db/repositories");

  // Must have a pending secret
  const encrypted = settingsRepo.get(TOTP_SETTINGS_KEYS.encryptedSecret);
  if (!encrypted) {
    return NextResponse.json(
      { error: "No 2FA setup in progress. Call /api/settings/2fa/setup first." },
      { status: 400 },
    );
  }

  // Already enabled?
  if (settingsRepo.get(TOTP_SETTINGS_KEYS.enabled) === "true") {
    return NextResponse.json(
      { error: "2FA is already enabled" },
      { status: 409 },
    );
  }

  // Decrypt and verify
  const secretBase32 = decryptSecret(encrypted);
  const valid = verifyToken(secretBase32, token, session.user.email);

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid code. Please try again." },
      { status: 400 },
    );
  }

  // Enable 2FA
  settingsRepo.set(TOTP_SETTINGS_KEYS.enabled, "true");

  // Generate and store recovery code
  const recoveryCode = generateRecoveryCode();
  const recoveryHash = await hashRecoveryCode(recoveryCode);
  settingsRepo.set(TOTP_SETTINGS_KEYS.recoveryCodeHash, recoveryHash);
  settingsRepo.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "false");

  // Reset brute force counters
  settingsRepo.set(TOTP_SETTINGS_KEYS.failedAttempts, "0");
  settingsRepo.delete(TOTP_SETTINGS_KEYS.lockUntil);

  return NextResponse.json({
    success: true,
    recoveryCode,
  });
}
