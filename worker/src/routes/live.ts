/**
 * GET /api/live — Worker + D1 liveness check.
 *
 * Requirements (from knowledge base):
 * - No auth, no cache
 * - Check core dependency (D1) connectivity
 * - Return status: "ok" | "error"; error responses must NOT contain "ok"
 * - Include version
 * - Lightweight — called frequently by monitors
 */

import { version } from "../../package.json";

const NO_CACHE_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function handleLive(db: D1Database): Promise<Response> {
  try {
    const result = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();

    if (result?.ok !== 1) {
      return new Response(
        JSON.stringify({
          status: "error",
          d1: "unexpected response",
          version,
          timestamp: new Date().toISOString(),
        }),
        { status: 503, headers: NO_CACHE_HEADERS },
      );
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        d1: "connected",
        version,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: NO_CACHE_HEADERS },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown failure";
    return new Response(
      JSON.stringify({
        status: "error",
        d1: "disconnected",
        error: message,
        version,
        timestamp: new Date().toISOString(),
      }),
      { status: 503, headers: NO_CACHE_HEADERS },
    );
  }
}
