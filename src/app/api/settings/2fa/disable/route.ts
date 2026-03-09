/**
 * POST /api/settings/2fa/disable
 * Disable 2FA.
 * - Normal: requires a valid TOTP token for confirmation.
 * - Force: when the current session was authenticated via recovery code
 *   (session-scoped JWT claim), accepts { force: true } without a TOTP token.
 *   Authorization is session-scoped, not global — only the session that
 *   actually used the recovery code can force-disable.
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
  const force = body.force === true;

  await ensureDbFromRequest();
  const totp = await getTotpService();

  // Force-disable path: session-scoped authorization via recovery code JWT claim
  if (force) {
    if (!session.user.recoverySession) {
      return NextResponse.json(
        { error: "Force disable is only allowed for sessions authenticated via recovery code" },
        { status: 403 },
      );
    }
    const result = totp.forceDisable();
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  // Normal path: requires TOTP token
  if (!token || !/^\d{6}$/.test(token)) {
    return NextResponse.json(
      { error: "A 6-digit code is required to disable 2FA" },
      { status: 400 },
    );
  }

  const result = totp.disable(token, session.user.email);

  if ("error" in result) {
    const status = "locked" in result && result.locked ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
