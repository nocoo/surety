import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/auth/tokens", async (c) => {
  const repos = c.get("repos");
  // Token list requires CF Access auth (not just API key)
  if (!c.get("accessAuthenticated")) {
    return c.json({ error: "Session authentication required" }, 401);
  }
  const tokens = await repos.apiTokens.listAll();
  return c.json(tokens.map((t: { id: number; name: string | null; tokenPrefix: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null }) => ({
    id: t.id, name: t.name, tokenPrefix: t.tokenPrefix,
    createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, expiresAt: t.expiresAt,
  })));
});

app.delete("/api/auth/tokens/:id", async (c) => {
  const repos = c.get("repos");
  if (!c.get("accessAuthenticated")) {
    return c.json({ error: "Session authentication required" }, 401);
  }
  const tokenId = parseInt(c.req.param("id"), 10);
  if (isNaN(tokenId)) return c.json({ error: "Invalid id" }, 400);
  const ok = await repos.apiTokens.revoke(tokenId);
  if (!ok) return c.json({ error: "Token not found" }, 404);
  return c.json({ success: true });
});

export default app;
