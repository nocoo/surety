import { Hono } from "hono";
import { fetchAuthorProfile } from "../lib/author-profile";
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

async function meResponse(
	email: string | null,
	fallbackName: string | null,
	authenticated: boolean,
) {
	if (!authenticated) {
		return { email: null, name: null, avatar: null, authenticated: false };
	}
	const profile = email ? await fetchAuthorProfile(email) : { name: null, avatar: null };
	return {
		email,
		name: profile.name ?? fallbackName,
		avatar: profile.avatar,
		authenticated: true,
	};
}

const app = new Hono<AppEnv>();

app.get("/api/me", async (c) => {
	// accessAuth has already verified the JWT upstream and may have stashed
	// the email on the context. Fall back to decoding the header ourselves
	// so the route still works even if accessAuth chose not to set the var.
	const ctxEmail = c.get("accessEmail");
	if (ctxEmail) {
		return c.json(await meResponse(ctxEmail, ctxEmail.split("@")[0] ?? null, true));
	}

	const jwt = c.req.header("Cf-Access-Jwt-Assertion");
	if (!jwt) {
		return c.json(await meResponse(null, null, false));
	}
	const payload = decodeJwtPayload(jwt);
	if (!payload) {
		return c.json(await meResponse(null, null, false));
	}
	const email = payload.email ?? null;
	const fallbackName = payload.name ?? email?.split("@")[0] ?? null;
	return c.json(await meResponse(email, fallbackName, true));
});

export default app;
