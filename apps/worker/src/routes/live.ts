import { Hono } from "hono";
import { APP_VERSION } from "@surety/api/lib/version";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

const bootedAt = Date.now();

app.get("/api/live", async (c) => {
  const timestamp = new Date().toISOString();
  const uptime = Math.round((Date.now() - bootedAt) / 1000);
  let database: { connected: boolean; error?: string } = { connected: false };

  try {
    await c.env.DB.prepare("SELECT 1 AS probe").first();
    database = { connected: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    database = { connected: false, error: msg };
  }

  const healthy = database.connected;
  return c.json(
    { status: healthy ? "ok" : "error", version: APP_VERSION, component: "worker", timestamp, uptime, database },
    healthy ? 200 : 503,
    { "Cache-Control": "no-store" },
  );
});

export default app;
