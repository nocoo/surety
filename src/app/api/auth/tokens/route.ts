import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * List the current user's API tokens. Always requires an interactive NextAuth
 * session — token-authenticated callers cannot list/revoke tokens to limit
 * blast radius if a token leaks.
 */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repos } = await getReposFromRequest();
  const tokens = await repos.apiTokens.listByEmail(email);

  return NextResponse.json(
    tokens.map((t) => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
    })),
  );
}
