/**
 * POST /api/settings/2fa/setup
 * Generate TOTP secret and QR code for 2FA setup.
 * Does NOT enable 2FA yet — user must verify with a token first.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import {
  generateSecret,
  encryptSecret,
  generateQRDataURL,
  TOTP_SETTINGS_KEYS,
} from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");

  // Check if already enabled
  const alreadyEnabled = settingsRepo.get(TOTP_SETTINGS_KEYS.enabled) === "true";
  if (alreadyEnabled) {
    return NextResponse.json(
      { error: "2FA is already enabled. Disable it first to re-setup." },
      { status: 409 },
    );
  }

  // Generate and store encrypted secret (not yet enabled)
  const secretBase32 = generateSecret();
  const encrypted = encryptSecret(secretBase32);
  settingsRepo.set(TOTP_SETTINGS_KEYS.encryptedSecret, encrypted);
  settingsRepo.set(TOTP_SETTINGS_KEYS.enabled, "false");

  // Generate QR code
  const qrDataURL = await generateQRDataURL(secretBase32, session.user.email);

  return NextResponse.json({
    qrDataURL,
    secret: secretBase32,
  });
}
