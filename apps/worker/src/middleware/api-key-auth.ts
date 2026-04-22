import type { Context, Next } from "hono";
import type { AppEnv } from "../lib/types";
import { isLocalhost } from "./is-localhost";

const PUBLIC_ROUTES = ["/api/live"];

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] ?? null;
}

export async function apiKeyAuth(c: Context<AppEnv>, next: Next) {
  if (PUBLIC_ROUTES.includes(c.req.path)) return next();

  if (c.env?.E2E_SKIP_AUTH === "true") return next();

  const host = c.req.header("host") || "";
  const hasBearer = (c.req.header("Authorization") ?? "").startsWith(
    "Bearer ",
  );
  // Local/dev hosts normally skip auth for easier debugging, but if the
  // caller explicitly presented a bearer token we still verify it so that
  // accessEmail gets populated (e.g. CLI hitting a local worker).
  if (isLocalhost(host) && !hasBearer) return next();

  if (c.get("accessAuthenticated")) return next();

  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await c.get("repos").apiTokens.verify(token);
  if (!result) {
    return c.json({ error: "Invalid API key" }, 403);
  }

  c.set("accessEmail", result.email);
  c.set("accessAuthenticated", true);
  c.get("repos").apiTokens.updateLastUsed(result.id).catch(() => {});
  return next();
}
