/**
 * R2 bucket resolver based on X-Target-DB header.
 * Mirrors the D1 resolver pattern in db.ts.
 */

import type { Env } from "./db";

const R2_MAP: Record<string, keyof Pick<Env, "R2_PROD" | "R2_TEST">> = {
  production: "R2_PROD",
  test: "R2_TEST",
};

export function resolveR2(
  request: Request,
  env: Env,
): { bucket: R2Bucket } | { error: Response } {
  const targetDb = request.headers.get("X-Target-DB") || "production";

  const bindingKey = R2_MAP[targetDb];
  if (!bindingKey) {
    return {
      error: new Response(
        JSON.stringify({
          error: `Unknown target database: ${targetDb}`,
          allowed: Object.keys(R2_MAP),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const bucket = env[bindingKey];
  if (!bucket) {
    return {
      error: new Response(
        JSON.stringify({ error: `R2 binding ${bindingKey} not configured` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  return { bucket };
}
