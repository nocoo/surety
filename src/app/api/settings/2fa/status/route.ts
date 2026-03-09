/**
 * GET /api/settings/2fa/status
 * Returns whether 2FA is enabled and recovery code status.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { TOTP_SETTINGS_KEYS } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");

  const enabled = settingsRepo.get(TOTP_SETTINGS_KEYS.enabled) === "true";
  const recoveryCodeUsed = settingsRepo.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed) === "true";

  return NextResponse.json({
    enabled,
    recoveryCodeUsed: enabled ? recoveryCodeUsed : false,
  });
}
