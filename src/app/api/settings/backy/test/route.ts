import { NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { readBackySettings } from "@/services/backy";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/backy/test — test connection to Backy webhook.
 *
 * Sends a HEAD request to the configured webhook URL with Bearer auth.
 * Returns the HTTP status and whether the connection succeeded.
 */
export async function POST() {
  await ensureDbFromRequest();

  const { webhookUrl, apiKey } = readBackySettings();

  if (!webhookUrl || !apiKey) {
    return NextResponse.json(
      { error: "Backy webhook URL and API key must be configured first" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return NextResponse.json({
      success: res.ok,
      status: res.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, status: 0, error: message },
      { status: 502 },
    );
  }
}
