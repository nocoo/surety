import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";
import { readBackySettings, writeBackySettings, maskApiKey, getEnvironment } from "@/services/backy";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/backy — read Backy webhook configuration.
 */
export async function GET() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  await getReposFromRequest();

  const { webhookUrl, apiKey } = await readBackySettings();

  return NextResponse.json({
    webhookUrl,
    apiKey: maskApiKey(apiKey),
    hasApiKey: apiKey.length > 0,
    environment: getEnvironment(),
  });
}

/**
 * PUT /api/settings/backy — update Backy webhook configuration.
 */
export async function PUT(request: NextRequest) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  await getReposFromRequest();

  const body = await request.json();
  const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (!webhookUrl) {
    return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  await writeBackySettings({ webhookUrl, apiKey });

  return NextResponse.json({
    webhookUrl,
    apiKey: maskApiKey(apiKey),
    hasApiKey: true,
    environment: getEnvironment(),
  });
}
