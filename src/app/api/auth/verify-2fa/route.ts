/**
 * POST /api/auth/verify-2fa
 * Verify TOTP token or recovery code during login.
 * On success: updates JWT session and sets trusted device cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import {
  decryptSecret,
  verifyToken,
  verifyRecoveryCode,
  isLockedOut,
  lockoutRemainingSeconds,
  recordFailedAttempt,
  resetBruteForce,
  createTrustedDeviceCookieValue,
  TRUSTED_DEVICE_COOKIE_NAME,
  TRUSTED_DEVICE_MAX_AGE,
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
  const type = (body.type as string) || "totp"; // "totp" or "recovery"
  const rememberDevice = body.rememberDevice !== false; // default true

  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");

  // Check 2FA is enabled
  if (settingsRepo.get(TOTP_SETTINGS_KEYS.enabled) !== "true") {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  // --- Brute force check (before any crypto work) ---
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

  // --- Validate input ---
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  let verified = false;

  if (type === "recovery") {
    // Recovery code verification
    const recoveryUsed = settingsRepo.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed) === "true";
    if (recoveryUsed) {
      return NextResponse.json(
        { error: "Recovery code has already been used" },
        { status: 400 },
      );
    }

    const recoveryHash = settingsRepo.get(TOTP_SETTINGS_KEYS.recoveryCodeHash);
    if (recoveryHash) {
      verified = await verifyRecoveryCode(token, recoveryHash);
      if (verified) {
        // Mark recovery code as used
        settingsRepo.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "true");
      }
    }
  } else {
    // TOTP verification
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: "A 6-digit code is required" },
        { status: 400 },
      );
    }

    const encrypted = settingsRepo.get(TOTP_SETTINGS_KEYS.encryptedSecret);
    if (!encrypted) {
      return NextResponse.json(
        { error: "2FA configuration is corrupted" },
        { status: 500 },
      );
    }

    const secretBase32 = decryptSecret(encrypted);
    verified = verifyToken(secretBase32, token, session.user.email);
  }

  if (!verified) {
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
      { status: 401 },
    );
  }

  // --- Success ---
  // Reset brute force counters
  const reset = resetBruteForce();
  settingsRepo.set(TOTP_SETTINGS_KEYS.failedAttempts, String(reset.failedAttempts));
  settingsRepo.delete(TOTP_SETTINGS_KEYS.lockUntil);

  // Build response with trusted device cookie
  const response = NextResponse.json({ success: true });

  if (rememberDevice) {
    const cookieValue = createTrustedDeviceCookieValue(session.user.email);
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
