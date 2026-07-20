/**
 * Coverage tests for the CF Access JWT verification branch in
 * `accessAuth`. Stubs `jose.jwtVerify` so we don't need a real
 * Cloudflare Access deployment.
 *
 * Behaviour under test: fail-CLOSED. On the CF Access-protected host
 * (`surety.hexly.ai`), every failure mode short-circuits with an error
 * response rather than falling through to apiKeyAuth.
 */
import { afterAll, describe, expect, test, vi } from "vitest";

let jwtResult: { ok: true; payload: Record<string, unknown> } | { ok: false };

vi.mock("jose", () => ({
	createRemoteJWKSet: () => () => ({}),
	jwtVerify: async () => {
		if (jwtResult.ok) {
			return { payload: jwtResult.payload, protectedHeader: {} };
		}
		throw new Error("invalid jwt");
	},
}));

afterAll(() => {
	vi.restoreAllMocks();
});

import { Hono } from "hono";
import type { AppEnv } from "../src/lib/types";
import { accessAuth } from "../src/middleware/access-auth";

/**
 * Stamp `cf` on a Request to simulate the Cloudflare edge having processed
 * it. The runtime adds this property in production; tests must do it
 * explicitly so that edge-witness checks (`isLocalhost`, `isMachineEndpoint`)
 * behave the same way they do at the edge.
 */
function cfEdgeRequest(url: string, init?: RequestInit): Request {
	const req = new Request(url, init);
	Object.assign(req, { cf: { colo: "TEST" } });
	return req;
}

function probeApp() {
	const app = new Hono<AppEnv>();
	app.use("*", accessAuth);
	app.get("/api/probe", (c) =>
		c.json({
			sessionAuthenticated: c.get("sessionAuthenticated") === true,
			accessAuthenticated: c.get("accessAuthenticated") === true,
			accessEmail: c.get("accessEmail") ?? null,
		}),
	);
	return app;
}

describe("accessAuth - CF JWT branch", () => {
	test("valid JWT with email payload sets session/access flags + email", async () => {
		jwtResult = { ok: true, payload: { email: "alice@hexly.ai" } };
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{
				headers: {
					host: "surety.hexly.ai",
					"Cf-Access-Jwt-Assertion": "valid-jwt",
				},
			},
			{
				CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
				CF_ACCESS_AUD: "aud-id",
			},
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.sessionAuthenticated).toBe(true);
		expect(body.accessAuthenticated).toBe(true);
		expect(body.accessEmail).toBe("alice@hexly.ai");
	});

	test("valid JWT without email field still flags session, leaves email null", async () => {
		jwtResult = { ok: true, payload: { sub: "user_42" } };
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{
				headers: {
					host: "surety.hexly.ai",
					"Cf-Access-Jwt-Assertion": "valid-no-email",
				},
			},
			{
				CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
				CF_ACCESS_AUD: "aud-id",
			},
		);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.sessionAuthenticated).toBe(true);
		expect(body.accessEmail).toBeNull();
	});

	test("forged JWT (signature invalid) → 403 fail-closed", async () => {
		jwtResult = { ok: false };
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{
				headers: {
					host: "surety.hexly.ai",
					"Cf-Access-Jwt-Assertion": "broken",
				},
			},
			{
				CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
				CF_ACCESS_AUD: "aud-id",
			},
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/invalid/i);
	});

	test("missing JWT header on prod host → 401 fail-closed", async () => {
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{ headers: { host: "surety.hexly.ai" } },
			{
				CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
				CF_ACCESS_AUD: "aud-id",
			},
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/missing/i);
	});

	test("CF_ACCESS env missing on prod host → 500 fail-closed", async () => {
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{
				headers: {
					host: "surety.hexly.ai",
					"Cf-Access-Jwt-Assertion": "anything",
				},
			},
			{},
		);
		expect(res.status).toBe(500);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/CF_ACCESS_TEAM_DOMAIN/);
	});

	test("CF_ACCESS partial env (team domain only) on prod host → 500 fail-closed", async () => {
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{
				headers: {
					host: "surety.hexly.ai",
					"Cf-Access-Jwt-Assertion": "anything",
				},
			},
			{ CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" },
		);
		expect(res.status).toBe(500);
	});

	test("localhost bypass still works (env unconfigured) — no fail-closed 500", async () => {
		const app = probeApp();
		const res = await app.request("/api/probe", { headers: { host: "localhost:7016" } }, {});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.accessAuthenticated).toBe(true);
		expect(body.sessionAuthenticated).toBe(true);
	});

	test("/api/live whitelist still works (env unconfigured) — no fail-closed 500", async () => {
		const app = new Hono<AppEnv>();
		app.use("*", accessAuth);
		app.get("/api/live", (c) => c.text("ok"));
		const res = await app.request("/api/live", { headers: { host: "surety.hexly.ai" } }, {});
		expect(res.status).toBe(200);
	});

	test("machine endpoint (surety-api.hexly.ai) bypasses Access when reached via CF edge", async () => {
		// The CLI/bearer host shares the Worker with the browser host. accessAuth
		// must not 401 it for a missing JWT — apiKeyAuth gates that route.
		const app = probeApp();
		const req = cfEdgeRequest("http://localhost/api/probe", {
			headers: { host: "surety-api.hexly.ai" },
		});
		const res = await app.request(req, undefined, {
			CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
			CF_ACCESS_AUD: "aud-id",
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.accessAuthenticated).toBe(false);
		expect(body.sessionAuthenticated).toBe(false);
	});

	test("machine endpoint host claim WITHOUT CF edge (spoofed Host) is not honoured", async () => {
		// Defence: a direct hit on *.workers.dev or any non-edge path with
		// Host: surety-api.hexly.ai must not bypass accessAuth. Without
		// c.req.raw.cf as proof of edge transit, the host header is
		// attacker-controlled and cannot be trusted.
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{ headers: { host: "surety-api.hexly.ai" } },
			{
				CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
				CF_ACCESS_AUD: "aud-id",
			},
		);
		// No bypass → JWT path runs → missing JWT → 401 fail-closed
		expect(res.status).toBe(401);
	});

	test("E2E_SKIP_AUTH=true bypasses JWT verification in non-prod (L2-HTTP)", async () => {
		// The L2-HTTP runner boots wrangler dev with E2E_SKIP_AUTH=true so the
		// suite can exercise the browser-host code path without a real CF
		// Access JWT. Without this bypass the suite would always see 500.
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{ headers: { host: "surety.hexly.ai" } },
			{ E2E_SKIP_AUTH: "true", ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(200);
	});

	test("E2E_SKIP_AUTH=true is ignored when ENVIRONMENT=production (still fail-closed)", async () => {
		const app = probeApp();
		const res = await app.request(
			"/api/probe",
			{ headers: { host: "surety.hexly.ai" } },
			{ E2E_SKIP_AUTH: "true", ENVIRONMENT: "production" },
		);
		expect(res.status).toBe(500);
	});

	test("JWKS cache reused across requests for same team domain", async () => {
		jwtResult = { ok: true, payload: { email: "cached@hexly.ai" } };
		const app = probeApp();
		const env = {
			CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
			CF_ACCESS_AUD: "aud-id",
		};
		for (let i = 0; i < 3; i++) {
			const res = await app.request(
				"/api/probe",
				{
					headers: {
						host: "surety.hexly.ai",
						"Cf-Access-Jwt-Assertion": "v",
					},
				},
				env,
			);
			expect(res.status).toBe(200);
		}
	});
});
