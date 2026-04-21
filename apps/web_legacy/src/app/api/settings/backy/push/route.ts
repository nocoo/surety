import { NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";
import { readBackySettings, pushBackupToBacky } from "@/services/backy";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/backy/push — push a backup to the Backy webhook.
 *
 * Builds a full backup, wraps it as multipart/form-data, and POSTs
 * it to the configured Backy webhook with Bearer auth.
 */
export async function POST() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { db } = await getReposFromRequest();

  const { webhookUrl, apiKey } = await readBackySettings();

  if (!webhookUrl || !apiKey) {
    return NextResponse.json(
      { error: "Backy webhook URL and API key must be configured first" },
      { status: 400 },
    );
  }

  const result = await pushBackupToBacky({ webhookUrl, apiKey }, db);

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Backy returned HTTP ${result.status}`,
        request: result.request,
        response: { status: result.status, body: result.body },
        durationMs: result.durationMs,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    request: result.request,
    response: { status: result.status, body: result.body },
    durationMs: result.durationMs,
  });
}
