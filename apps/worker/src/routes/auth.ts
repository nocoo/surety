import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/auth/tokens", async (c) => {
  const repos = c.get("repos");
  // Token list requires CF Access (interactive session) — bearer/CLI auth
  // must NOT be able to enumerate other users' tokens.
  if (!c.get("sessionAuthenticated")) {
    return c.json({ error: "Session authentication required" }, 401);
  }
  const email = c.get("accessEmail");
  const tokens = email
    ? await repos.apiTokens.listByEmail(email)
    : await repos.apiTokens.listAll();
  return c.json(tokens.map((t: { id: number; name: string | null; tokenPrefix: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null }) => ({
    id: t.id, name: t.name, tokenPrefix: t.tokenPrefix,
    createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, expiresAt: t.expiresAt,
  })));
});

app.delete("/api/auth/tokens/:id", async (c) => {
  const repos = c.get("repos");
  if (!c.get("sessionAuthenticated")) {
    return c.json({ error: "Session authentication required" }, 401);
  }
  const tokenId = parseInt(c.req.param("id"), 10);
  if (isNaN(tokenId)) return c.json({ error: "Invalid id" }, 400);
  // When we know the session email, only allow revoking tokens owned by
  // that email. Without an email (e.g. localhost dev bypass) we fall back
  // to the previous unscoped revoke.
  const email = c.get("accessEmail");
  if (email) {
    const existing = await repos.apiTokens.findById(tokenId);
    if (!existing) return c.json({ error: "Token not found" }, 404);
    if (existing.email !== email) {
      return c.json({ error: "Token not found" }, 404);
    }
  }
  const ok = await repos.apiTokens.revoke(tokenId);
  if (!ok) return c.json({ error: "Token not found" }, 404);
  return c.json({ success: true });
});

export default app;
