/**
 * POST /api/settings/2fa/setup
 * Generate TOTP secret and QR code for 2FA setup.
 * Does NOT enable 2FA yet — user must verify with a token first.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getTotpService } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await getReposFromRequest();
  const totp = await getTotpService();

  // Check if already enabled
  if (await totp.isEnabled()) {
    return NextResponse.json(
      { error: "2FA is already enabled. Disable it first to re-setup." },
      { status: 409 },
    );
  }

  const result = await totp.setup(session.user.email);

  return NextResponse.json({
    qrDataURL: result.qrDataURL,
    secret: result.secret,
  });
}
