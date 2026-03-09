/**
 * POST /api/settings/2fa/verify-setup
 * Verify the TOTP token to confirm 2FA setup.
 * On success: enables 2FA and returns recovery code.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { getTotpService } from "@/lib/totp";

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

  return NextResponse.json({
    success: true,
    recoveryCode: result.recoveryCode,
  });
}
