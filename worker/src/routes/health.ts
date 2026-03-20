/**
 * GET /health — Worker + D1 liveness check.
 * No authentication required.
 */

export async function handleHealth(db: D1Database): Promise<Response> {
  try {
    const result = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();

    return new Response(
      JSON.stringify({
        status: "ok",
        d1: result?.ok === 1 ? "connected" : "unexpected",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        status: "error",
        d1: "disconnected",
        error: message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
