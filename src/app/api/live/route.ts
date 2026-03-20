import { NextResponse } from "next/server";
import { checkHealth, type HealthDeps } from "@/lib/health";
import { APP_VERSION } from "@/lib/version";
import { getDbForRequest } from "@/db/index";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const isBun = typeof globalThis.Bun !== "undefined";

export async function GET() {
  const deps: HealthDeps = {
    probeDatabase: async () => {
      try {
        const db = getDbForRequest();
        const result = await db.get(sql`SELECT 1 AS alive`);
        if (!result) {
          return { connected: false, error: "empty result from probe query" };
        }
        return { connected: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "unknown";
        return { connected: false, error: message };
      }
    },
    uptime: process.uptime(),
    runtime: isBun ? "bun" : "node",
    version: process.env.npm_package_version ?? APP_VERSION,
    rssBytes: process.memoryUsage().rss,
  };

  const result = await checkHealth(deps);

  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
