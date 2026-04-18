import { NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";
import { readBackySettings, fetchBackyHistory } from "@/services/backy";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/backy/history — fetch remote backup history from Backy.
 *
 * Proxies a GET request to the Backy webhook to retrieve total backup
 * count and recent backup entries.
 */
export async function GET() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  await getReposFromRequest();

  const { webhookUrl, apiKey } = await readBackySettings();

  if (!webhookUrl || !apiKey) {
    return NextResponse.json(
      { error: "Backy webhook URL and API key must be configured first" },
      { status: 400 },
    );
  }

  const result = await fetchBackyHistory({ webhookUrl, apiKey });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || `HTTP ${result.status}` },
      { status: 502 },
    );
  }

  return NextResponse.json(result.data);
}
