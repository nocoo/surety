/**
 * GET /api/live — Worker liveness check (surety standard).
 *
 * Response shape: { status, version, component, timestamp, uptime, database? }
 * 200 = healthy, 503 = unhealthy. Cache-Control: no-store.
 */

import { version } from "../../package.json";

const bootedAt = Date.now();

const COMPONENT = "worker";

const HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export async function handleLive(db: D1Database): Promise<Response> {
  const base = {
    version,
    component: COMPONENT,
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - bootedAt) / 1000),
  };

  try {
    const row = await db
      .prepare("SELECT 1 AS probe")
      .first<{ probe: number }>();

    if (row?.probe !== 1) {
      return respond(503, {
        status: "error",
        ...base,
        database: { connected: false, error: "unexpected probe result" },
      });
    }

    return respond(200, {
      status: "ok",
      ...base,
      database: { connected: true },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "unknown failure";
    const safe = raw.replace(/\bok\b/gi, "***");
    return respond(503, {
      status: "error",
      ...base,
      database: { connected: false, error: safe },
    });
  }
}

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
