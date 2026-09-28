import type { Context, Next } from "hono";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../lib/types";
import { isLocalhost } from "./is-localhost";

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheTeamDomain: string | null = null;

function getJWKS(teamDomain: string) {
	if (jwksCache && jwksCacheTeamDomain === teamDomain) return jwksCache;
	jwksCache = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
	jwksCacheTeamDomain = teamDomain;
	return jwksCache;
}

// The bearer-token API host bypasses CF Access entirely; apiKeyAuth handles it.
//
// Host headers are attacker-controlled, so the raw value is not enough — a
// direct hit on `*.workers.dev` carrying `Host: surety-api.hexly.ai` would
// otherwise bypass accessAuth. We require `c.req.raw.cf` as proof that the
// request traversed the Cloudflare edge, mirroring isLocalhost's stance.
// On the CF edge the Host header reflects the actual bound custom domain,
// so spoofing is not viable.
function isMachineEndpoint(c: Context<AppEnv>): boolean {
	const onCfEdge = Boolean((c.req.raw as { cf?: unknown }).cf);
	if (!onCfEdge) return false;
	const host = c.req.header("host") ?? "";
	return host === "surety-api.hexly.ai";
}

export async function accessAuth(c: Context<AppEnv>, next: Next) {
	if (c.req.path === "/api/live") return next();

	if (isMachineEndpoint(c)) return next();
	if (isLocalhost(c) && (c.req.header("Authorization") ?? "").startsWith("Bearer ")) return next();

	const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
	const aud = c.env.CF_ACCESS_AUD;

	if (!(teamDomain && aud)) {
		return c.json(
			{
				error: "Access authentication not configured. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.",
			},
			500,
		);
	}

	const jwt = c.req.header("Cf-Access-Jwt-Assertion");
	if (!jwt) {
		return c.json({ error: "Missing Access JWT" }, 401);
	}

	try {
		const jwks =
			c.env.ENVIRONMENT === "local" && c.env.LOCAL_ACCESS_JWKS
				? createLocalJWKSet(JSON.parse(c.env.LOCAL_ACCESS_JWKS))
				: getJWKS(teamDomain);
		const { payload } = await jwtVerify(jwt, jwks, {
			issuer: `https://${teamDomain}`,
			audience: aud,
		});
		c.set("accessAuthenticated", true);
		c.set("sessionAuthenticated", true);
		if (typeof payload.email === "string") {
			c.set("accessEmail", payload.email);
		}
	} catch {
		return c.json({ error: "Invalid Access JWT" }, 403);
	}

	return next();
}
