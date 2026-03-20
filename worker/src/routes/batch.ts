/**
 * POST /batch — execute multiple prepared statements atomically on D1.
 * D1 batch() guarantees all-or-nothing execution.
 */

export async function handleBatch(
  request: Request,
  db: D1Database,
): Promise<Response> {
  let body: { statements: Array<{ sql: string; params?: unknown[] }> };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.statements) || body.statements.length === 0) {
    return jsonResponse({ error: "Missing or empty 'statements' array" }, 400);
  }

  // Validate all statements before execution
  for (let i = 0; i < body.statements.length; i++) {
    const stmt = body.statements[i];
    if (!stmt.sql || typeof stmt.sql !== "string") {
      return jsonResponse(
        { error: `Invalid statement at index ${i}: missing 'sql'` },
        400,
      );
    }
  }

  try {
    const preparedStatements = body.statements.map((stmt) =>
      db.prepare(stmt.sql).bind(...(stmt.params ?? [])),
    );

    const batchResults = await db.batch(preparedStatements);

    return jsonResponse({
      success: true,
      results: batchResults.map((result) => ({
        results: result.results,
        meta: {
          changes: result.meta?.changes ?? 0,
          duration: result.meta?.duration ?? 0,
          rows_read: result.meta?.rows_read ?? 0,
          rows_written: result.meta?.rows_written ?? 0,
        },
      })),
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
