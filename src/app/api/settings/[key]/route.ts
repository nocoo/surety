import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { SENSITIVE_KEY_PREFIX } from "@/lib/totp";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string }> };

/** Guard: reject any request targeting totp.* keys */
function isSensitiveKey(key: string): boolean {
  return key.startsWith(SENSITIVE_KEY_PREFIX);
}

const SENSITIVE_DENIED = NextResponse.json(
  { error: "Cannot access TOTP settings through this endpoint" },
  { status: 403 },
);

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");
  const { key } = await context.params;

  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (isSensitiveKey(key)) return SENSITIVE_DENIED;

  const value = settingsRepo.get(key);

  return NextResponse.json({
    key,
    value: value ?? null,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");
  const { key } = await context.params;

  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (isSensitiveKey(key)) return SENSITIVE_DENIED;

  const body = await request.json();

  if (body.value === undefined) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const setting = settingsRepo.set(key, String(body.value));

  return NextResponse.json({
    key: setting.key,
    value: setting.value,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");
  const { key } = await context.params;

  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (isSensitiveKey(key)) return SENSITIVE_DENIED;

  const deleted = settingsRepo.delete(key);

  if (!deleted) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
