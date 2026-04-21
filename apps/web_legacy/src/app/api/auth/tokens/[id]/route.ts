import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Revoke an API token. The caller must own the token (verified by email match)
 * and must be authenticated via session, not via another token.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const tokenId = parseInt(id, 10);
  if (isNaN(tokenId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { repos } = await getReposFromRequest();
  const existing = await repos.apiTokens.findById(tokenId);
  if (!existing || existing.email !== email) {
    // Don't reveal whether the token exists for someone else.
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const ok = await repos.apiTokens.revoke(tokenId);
  if (!ok) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
