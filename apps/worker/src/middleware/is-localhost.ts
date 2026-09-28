import type { Context } from "hono";
import type { AppEnv } from "../lib/types";

export function isLocalhost(c: Context<AppEnv>): boolean {
	if ((c.req.raw as { cf?: unknown }).cf) return false;
	const host = (c.req.header("host") ?? "").split(":")[0];
	return host === "localhost" || host === "127.0.0.1" || host === "surety.dev.hexly.ai";
}
