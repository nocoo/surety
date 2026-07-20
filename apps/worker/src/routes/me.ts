import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

export interface AccessJwtPayload {
	email?: string;
	name?: string;
}

export function decodeJwtPayload(jwt: string): AccessJwtPayload | null {
	const parts = jwt.split(".");
	if (parts.length !== 3 || !parts[1]) return null;
	try {
		const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
		return JSON.parse(payload) as AccessJwtPayload;
	} catch {
		return null;
	}
}

const app = new Hono<AppEnv>();

app.get("/api/me", (c) => {
	// accessAuth has already verified the JWT upstream and may have stashed
	// the email on the context. Fall back to decoding the header ourselves
	// so the route still works even if accessAuth chose not to set the var.
	const ctxEmail = c.get("accessEmail");
	if (ctxEmail) {
		return c.json({ email: ctxEmail, name: ctxEmail.split("@")[0] ?? null, authenticated: true });
	}

	const jwt = c.req.header("Cf-Access-Jwt-Assertion");
	if (!jwt) {
		return c.json({ email: null, name: null, authenticated: false });
	}
	const payload = decodeJwtPayload(jwt);
	if (!payload) {
		return c.json({ email: null, name: null, authenticated: false });
	}
	return c.json({
		email: payload.email ?? null,
		name: payload.name ?? payload.email?.split("@")[0] ?? null,
		authenticated: true,
	});
});

export default app;
