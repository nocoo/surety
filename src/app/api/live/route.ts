import { NextResponse } from "next/server";
import { checkHealth, type HealthDeps } from "@/lib/health";

export const dynamic = "force-dynamic";

const isBun = typeof globalThis.Bun !== "undefined";

export async function GET() {
  const deps: HealthDeps = {
    getRawSqlite: () => {
      // Lazy-import to avoid pulling the whole db module at parse time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDb, getRawSqlite } = require("@/db/index");
      // Ensure a connection exists (getDb is a no-op when already connected)
      getDb();
      return getRawSqlite();
    },
    uptime: process.uptime(),
    runtime: isBun ? "bun" : "node",
    version: process.env.npm_package_version ?? "0.1.0",
    rssBytes: process.memoryUsage().rss,
  };

  const result = checkHealth(deps);

  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
