/**
 * POST /api/settings/2fa/reset (E2E ONLY)
 * Force-reset all 2FA state. Only available in E2E test mode.
 *
 * This endpoint is for test cleanup purposes only.
 * It bypasses normal 2FA verification requirements.
 */
import { NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { TOTP_SETTINGS_KEYS } from "@/lib/totp";

export const dynamic = "force-dynamic";

// Only allow in E2E test mode
const E2E_MODE = process.env.E2E_SKIP_AUTH === "true";

export async function POST() {
  if (!E2E_MODE) {
    return NextResponse.json(
      { error: "This endpoint is only available in E2E test mode" },
      { status: 403 }
    );
  }

  const { repos } = await getReposFromRequest();

  // Delete all TOTP settings
  const keysToDelete = Object.values(TOTP_SETTINGS_KEYS);
  
  for (const key of keysToDelete) {
    await repos.settings.delete(key);
  }

  return NextResponse.json({ success: true, deletedKeys: keysToDelete });
}
