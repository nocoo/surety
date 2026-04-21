/**
 * POST /query — execute a single prepared statement on D1.
 */

export async function handleQuery(
  request: Request,
  db: D1Database,
): Promise<Response> {
  let body: { sql: string; params?: unknown[] };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.sql || typeof body.sql !== "string") {
    return jsonResponse({ error: "Missing or invalid 'sql' field" }, 400);
  }

  try {
    const stmt = db.prepare(body.sql).bind(...(body.params ?? []));
    const result = await stmt.all();

    return jsonResponse({
      success: true,
      results: result.results,
      meta: {
        changes: result.meta?.changes ?? 0,
        duration: result.meta?.duration ?? 0,
        rows_read: result.meta?.rows_read ?? 0,
        rows_written: result.meta?.rows_written ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
