/**
 * POST /api/settings/2fa/disable
 * Disable 2FA. Requires a valid TOTP token for confirmation.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { decryptSecret, verifyToken, TOTP_SETTINGS_KEYS } from "@/lib/totp";

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
    return NextResponse.json(
      { error: "Invalid code" },
      { status: 400 },
    );
  }

  // Disable 2FA — remove all TOTP settings
  for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
    settingsRepo.delete(key);
  }

  return NextResponse.json({ success: true });
}
