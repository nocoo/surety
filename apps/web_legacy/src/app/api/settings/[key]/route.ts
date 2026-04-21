import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string }> };

/**
 * Legacy TOTP keys that may exist in old databases.
 * These are rejected on all operations.
 */
const LEGACY_SENSITIVE_PREFIX = "totp.";

function isLegacySensitiveKey(key: string): boolean {
  return key.startsWith(LEGACY_SENSITIVE_PREFIX);
}

/** Factory: create fresh 403 response each time (Response body is single-use) */
function legacySensitiveDenied(): NextResponse {
  return NextResponse.json(
    { error: "Cannot access legacy sensitive settings" },
    { status: 403 },
  );
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { key } = await context.params;

  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (isLegacySensitiveKey(key)) return legacySensitiveDenied();

  const value = await repos.settings.get(key);

  return NextResponse.json({
    key,
    value: value ?? null,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { key } = await context.params;

  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (isLegacySensitiveKey(key)) return legacySensitiveDenied();

  const body = await request.json();

  if (body.value === undefined) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const setting = await repos.settings.set(key, String(body.value));

  return NextResponse.json({
    key: setting.key,
    value: setting.value,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { key } = await context.params;

  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (isLegacySensitiveKey(key)) return legacySensitiveDenied();

  const deleted = await repos.settings.delete(key);

  if (!deleted) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
