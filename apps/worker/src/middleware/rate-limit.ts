import type { Context, MiddlewareHandler, Next } from "hono";
import type { AppEnv } from "../lib/types";

export type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type Entry = { count: number; resetAt: number };

const CLEANUP_INTERVAL = 100;

export function getClientIp(c: Context<AppEnv>): string {
  const cfIp = c.req.header("CF-Connecting-IP");
  if (cfIp) return cfIp;
  const xff = c.req.header("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xReal = c.req.header("x-real-ip");
  if (xReal) return xReal;
  return "unknown";
}

export function createRateLimiter(
  opts: RateLimitOptions,
): MiddlewareHandler<AppEnv> {
  const store = new Map<string, Entry>();
  let requestsSinceCleanup = 0;

  return async function rateLimit(c: Context<AppEnv>, next: Next) {
    const now = Date.now();
    const ip = getClientIp(c);

    requestsSinceCleanup++;
    if (requestsSinceCleanup >= CLEANUP_INTERVAL) {
      requestsSinceCleanup = 0;
      for (const [key, entry] of store) {
        if (entry.resetAt <= now) store.delete(key);
      }
    }

    const existing = store.get(ip);
    let entry: Entry;
    if (!existing || existing.resetAt <= now) {
      entry = { count: 1, resetAt: now + opts.windowMs };
      store.set(ip, entry);
    } else {
      existing.count++;
      entry = existing;
    }

    if (entry.count > opts.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too Many Requests" }, 429);
    }

    return next();
  };
}
