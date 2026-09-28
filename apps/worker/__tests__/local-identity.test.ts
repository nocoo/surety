import { Hono } from "hono";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { expect, test } from "vitest";
import type { AppEnv } from "../src/lib/types";
import { accessAuth } from "../src/middleware/access-auth";

test("fixture identities use signature, audience, issuer and expiry verification", async () => {
	const keys = await generateKeyPair("RS256");
	const jwk = await exportJWK(keys.publicKey);
	const env = {
		ENVIRONMENT: "local",
		LOCAL_ACCESS_JWKS: JSON.stringify({ keys: [jwk] }),
		CF_ACCESS_TEAM_DOMAIN: "surety-fixture.invalid",
		CF_ACCESS_AUD: "run-a",
	};
	const app = new Hono<AppEnv>();
	app.use("*", accessAuth);
	app.get("/api/probe", (c) =>
		c.json({ email: c.get("accessEmail"), session: c.get("sessionAuthenticated") }),
	);
	for (const [audience, issuer, expiry, expected] of [
		["run-a", "https://surety-fixture.invalid", "1h", 200],
		["run-b", "https://surety-fixture.invalid", "1h", 403],
		["run-a", "https://foreign.invalid", "1h", 403],
		["run-a", "https://surety-fixture.invalid", "-1h", 403],
	] as const) {
		const jwt = await new SignJWT({ email: "demo@example.invalid" })
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer(issuer)
			.setAudience(audience)
			.setExpirationTime(expiry)
			.sign(keys.privateKey);
		const response = await app.request(
			"/api/probe",
			{ headers: { "Cf-Access-Jwt-Assertion": jwt } },
			env,
		);
		expect(response.status).toBe(expected);
		if (expected === 200)
			expect(await response.json()).toEqual({ email: "demo@example.invalid", session: true });
	}
	const missing = await app.request("/api/probe", {}, env);
	expect(missing.status).toBe(401);
	const bad = await app.request(
		"/api/probe",
		{ headers: { "Cf-Access-Jwt-Assertion": "forged" } },
		env,
	);
	expect(bad.status).toBe(403);
});
