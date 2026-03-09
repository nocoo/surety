/**
 * POST /api/settings/2fa/disable
 * Disable 2FA. Requires a valid TOTP token for confirmation.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import {
  decryptSecret,
  verifyToken,
  isLockedOut,
  lockoutRemainingSeconds,
  recordFailedAttempt,
  resetBruteForce,
  TOTP_SETTINGS_KEYS,
  type BruteForceState,
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
      { error: "A 6-digit code is required to disable 2FA" },
      { status: 400 },
    );
  }

  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");

  // --- Brute force check ---
  const bruteState: BruteForceState = {
    failedAttempts: Number(settingsRepo.get(TOTP_SETTINGS_KEYS.failedAttempts) ?? "0"),
    lockUntil: settingsRepo.get(TOTP_SETTINGS_KEYS.lockUntil) ?? null,
  };

  if (isLockedOut(bruteState)) {
    const remaining = lockoutRemainingSeconds(bruteState);
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(remaining / 60)} minute(s).` },
      { status: 429 },
    );
  }

  // Must be currently enabled
  if (settingsRepo.get(TOTP_SETTINGS_KEYS.enabled) !== "true") {
    return NextResponse.json(
      { error: "2FA is not enabled" },
      { status: 400 },
    );
  }

  // Decrypt and verify
  const encrypted = settingsRepo.get(TOTP_SETTINGS_KEYS.encryptedSecret);
  if (!encrypted) {
    return NextResponse.json(
      { error: "2FA configuration is corrupted" },
      { status: 500 },
    );
  }

  const secretBase32 = decryptSecret(encrypted);
  const valid = verifyToken(secretBase32, token, session.user.email);

  if (!valid) {
    // Record failed attempt
    const newState = recordFailedAttempt(bruteState);
    settingsRepo.set(TOTP_SETTINGS_KEYS.failedAttempts, String(newState.failedAttempts));
    if (newState.lockUntil) {
      settingsRepo.set(TOTP_SETTINGS_KEYS.lockUntil, newState.lockUntil);
    }

    const attemptsLeft = 5 - newState.failedAttempts;
    return NextResponse.json(
      {
        error: newState.lockUntil
          ? "Too many attempts. Account locked for 15 minutes."
          : `Invalid code. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining.` : ""}`,
      },
      { status: 400 },
    );
  }

  // --- Success: reset brute force then disable ---
  const reset = resetBruteForce();
  settingsRepo.set(TOTP_SETTINGS_KEYS.failedAttempts, String(reset.failedAttempts));
  settingsRepo.delete(TOTP_SETTINGS_KEYS.lockUntil);

  // Disable 2FA — remove all TOTP settings
  for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
    settingsRepo.delete(key);
  }

  return NextResponse.json({ success: true });
}
