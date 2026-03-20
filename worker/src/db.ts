/**
 * D1 binding resolver based on X-Target-DB header.
 */

export interface Env {
  DB_PROD: D1Database;
  DB_API_E2E: D1Database;
  DB_UI_E2E: D1Database;
  DB_MCP_E2E: D1Database;
  WORKER_SHARED_SECRET: string;
}

const DB_MAP: Record<string, keyof Pick<Env, "DB_PROD" | "DB_API_E2E" | "DB_UI_E2E" | "DB_MCP_E2E">> = {
  production: "DB_PROD",
  "api-e2e": "DB_API_E2E",
  "ui-e2e": "DB_UI_E2E",
  "mcp-e2e": "DB_MCP_E2E",
};

export function resolveDb(
  request: Request,
  env: Env,
): { db: D1Database } | { error: Response } {
  const targetDb = request.headers.get("X-Target-DB") || "production";

  const bindingKey = DB_MAP[targetDb];
  if (!bindingKey) {
    return {
      error: new Response(
        JSON.stringify({
          error: `Unknown target database: ${targetDb}`,
          allowed: Object.keys(DB_MAP),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const db = env[bindingKey];
  if (!db) {
    return {
      error: new Response(
        JSON.stringify({ error: `D1 binding ${bindingKey} not configured` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  return { db };
}
