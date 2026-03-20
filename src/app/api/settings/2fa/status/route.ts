/**
 * GET /api/settings/2fa/status
 * Returns whether 2FA is enabled and recovery code status.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getTotpService } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await getReposFromRequest();
  const totp = await getTotpService();
  const status = await totp.getStatus();

  return NextResponse.json(status);
}
