/**
 * D1 binding resolver based on X-Target-DB header.
 */

export interface Env {
  DB_PROD: D1Database;
  DB_DEV: D1Database;
  WORKER_SHARED_SECRET: string;
}

const DB_MAP: Record<string, keyof Pick<Env, "DB_PROD" | "DB_DEV">> = {
  production: "DB_PROD",
  dev: "DB_DEV",
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
