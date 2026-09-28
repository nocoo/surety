import type { Context, Next } from "hono";
import type { AppEnv } from "../lib/types";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hasBearer(c: Context<AppEnv>): boolean {
	return (c.req.header("Authorization") ?? "").startsWith("Bearer ");
}

function originFromHeaders(c: Context<AppEnv>): string | null {
	const origin = c.req.header("Origin");
	if (origin) return origin;
	const referer = c.req.header("Referer");
	if (referer) {
		try {
			return new URL(referer).origin;
		} catch {
			return null;
		}
	}
	return null;
}

function targetOrigin(c: Context<AppEnv>): string | null {
	const host = c.req.header("Host");
	if (!host) return null;
	let scheme: string;
	try {
		scheme = new URL(c.req.url).protocol.replace(":", "");
	} catch {
		return null;
	}
	return `${scheme}://${host}`;
}

export async function originGuard(c: Context<AppEnv>, next: Next) {
	if (SAFE_METHODS.has(c.req.method)) return next();
	if (hasBearer(c) && !c.get("sessionAuthenticated")) return next();
	if (c.req.path === "/api/live") return next();

	const requestOrigin = originFromHeaders(c);
	if (!requestOrigin) {
		return c.json({ error: "Origin or Referer header required" }, 403);
	}
	const expected = targetOrigin(c);
	if (!expected || requestOrigin !== expected) {
		return c.json({ error: "Cross-origin request rejected" }, 403);
	}
	return next();
}
