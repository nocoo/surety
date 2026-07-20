/**
 * Middleware unit tests for the CF Worker auth stack.
 *
 * We mount each middleware on a throwaway Hono app and inspect the
 * context flags they set (accessAuthenticated, accessEmail) or the
 * response they emit.
 */

import type { AllRepos } from "@surety/db/repositories";
import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../src/lib/types";
import { accessAuth } from "../src/middleware/access-auth";
import { apiKeyAuth } from "../src/middleware/api-key-auth";
import { isLocalhost } from "../src/middleware/is-localhost";
import meRoutes from "../src/routes/me";

function makeApp(middleware: Parameters<Hono<AppEnv>["use"]>[1], repos?: unknown) {
	const app = new Hono<AppEnv>();
	if (repos !== undefined) {
		app.use("*", async (c, next) => {
			c.set("repos", repos as AllRepos);
			return next();
		});
	}
	app.use("*", middleware);
	app.get("/api/live", (c) => c.text("live"));
	app.get("/api/probe", (c) =>
		c.json({
			accessAuthenticated: c.get("accessAuthenticated") === true,
			accessEmail: c.get("accessEmail") ?? null,
		}),
	);
	return app;
}

function ctxWithHost(host: string, cf?: Record<string, unknown>) {
	const raw = { cf };
	return {
		req: {
			header: (name: string) => (name.toLowerCase() === "host" ? host : undefined),
			raw,
		},
	} as Parameters<typeof isLocalhost>[0];
}

describe("isLocalhost", () => {
	test("matches localhost, 127.0.0.1, *.dev.hexly.ai when no CF edge", () => {
		expect(isLocalhost(ctxWithHost("localhost"))).toBe(true);
		expect(isLocalhost(ctxWithHost("localhost:7016"))).toBe(true);
		expect(isLocalhost(ctxWithHost("127.0.0.1:7016"))).toBe(true);
		expect(isLocalhost(ctxWithHost("app.dev.hexly.ai"))).toBe(true);
	});

	test("rejects prod hostnames", () => {
		expect(isLocalhost(ctxWithHost("surety.hexly.ai"))).toBe(false);
		expect(isLocalhost(ctxWithHost("example.com"))).toBe(false);
		expect(isLocalhost(ctxWithHost(""))).toBe(false);
	});

	test("rejects spoofed Host: localhost when request came through CF edge", () => {
		// request.cf is populated only on real CF edge requests; its presence
		// proves the Host header is whatever the Worker is bound to (never
		// localhost), so a spoofed Host must not be treated as local.
		expect(isLocalhost(ctxWithHost("localhost", { colo: "SJC" }))).toBe(false);
		expect(isLocalhost(ctxWithHost("127.0.0.1:7016", { colo: "SJC" }))).toBe(false);
	});

	test("still accepts *.dev.hexly.ai on CF edge (dev environment)", () => {
		expect(isLocalhost(ctxWithHost("app.dev.hexly.ai", { colo: "SJC" }))).toBe(true);
	});
});

describe("accessAuth middleware", () => {
	test("skips /api/live entirely (no flag set)", async () => {
		const app = makeApp(accessAuth);
		const res = await app.request("/api/live", {
			headers: { host: "surety.hexly.ai" },
		});
		expect(res.status).toBe(200);
	});

	test("localhost host bypass sets accessAuthenticated=true", async () => {
		const app = makeApp(accessAuth);
		const res = await app.request("/api/probe", {
			headers: { host: "localhost:7016" },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			accessAuthenticated: boolean;
			accessEmail: string | null;
		};
		expect(body.accessAuthenticated).toBe(true);
		expect(body.accessEmail).toBeNull();
	});

	test("localhost with Bearer token defers to apiKeyAuth (no bypass flag)", async () => {
		// When a bearer token is present, accessAuth must NOT short-circuit —
		// otherwise apiKeyAuth is skipped and accessEmail never gets populated,
		// breaking /api/me for CLI users hitting a local worker.
		const app = makeApp(accessAuth);
		const res = await app.request("/api/probe", {
			headers: {
				host: "localhost:7016",
				authorization: "Bearer sk_xxx",
			},
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			accessAuthenticated: boolean;
			accessEmail: string | null;
		};
		expect(body.accessAuthenticated).toBe(false);
		expect(body.accessEmail).toBeNull();
	});

	test("no CF_ACCESS config and not localhost → 500 fail-closed", async () => {
		const app = makeApp(accessAuth);
		const res = await app.request("/api/probe", { headers: { host: "surety.hexly.ai" } }, {});
		expect(res.status).toBe(500);
	});
});

describe("apiKeyAuth middleware", () => {
	test("allows /api/live without token", async () => {
		const app = makeApp(apiKeyAuth);
		const res = await app.request("/api/live", {
			headers: { host: "surety.hexly.ai" },
		});
		expect(res.status).toBe(200);
	});

	test("localhost host bypass allows anonymous requests", async () => {
		const app = makeApp(apiKeyAuth);
		const res = await app.request("/api/probe", {
			headers: { host: "127.0.0.1:7016" },
		});
		expect(res.status).toBe(200);
	});

	test("prod host with no auth → 401", async () => {
		const app = makeApp(apiKeyAuth, {
			apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
		});
		const res = await app.request("/api/probe", {
			headers: { host: "surety.hexly.ai" },
		});
		expect(res.status).toBe(401);
	});

	test("prod host with non-Bearer Authorization → 401", async () => {
		const app = makeApp(apiKeyAuth, {
			apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
		});
		const res = await app.request("/api/probe", {
			headers: {
				host: "surety.hexly.ai",
				authorization: "Basic abc",
			},
		});
		expect(res.status).toBe(401);
	});

	test("prod host with malformed Bearer (wrong arity) → 401", async () => {
		const app = makeApp(apiKeyAuth, {
			apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
		});
		const res = await app.request("/api/probe", {
			headers: {
				host: "surety.hexly.ai",
				authorization: "Bearer",
			},
		});
		expect(res.status).toBe(401);
	});

	test("already accessAuthenticated skips token verification", async () => {
		const app = new Hono<AppEnv>();
		app.use("*", async (c, next) => {
			c.set("accessAuthenticated", true);
			c.set("accessEmail", "cf@hexly.ai");
			return next();
		});
		app.use("*", apiKeyAuth);
		app.get("/api/probe", (c) =>
			c.json({
				accessAuthenticated: c.get("accessAuthenticated") === true,
				accessEmail: c.get("accessEmail") ?? null,
			}),
		);
		const res = await app.request("/api/probe", {
			headers: { host: "surety.hexly.ai" },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { accessEmail: string | null };
		expect(body.accessEmail).toBe("cf@hexly.ai");
	});

	test("prod host with invalid Bearer token → 403", async () => {
		const app = makeApp(apiKeyAuth, {
			apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
		});
		const res = await app.request("/api/probe", {
			headers: {
				host: "surety.hexly.ai",
				authorization: "Bearer bad",
			},
		});
		expect(res.status).toBe(403);
	});

	test("prod host with valid Bearer token → passthrough", async () => {
		let lastUsedId = -1;
		let resolveUpdated!: () => void;
		const updated = new Promise<void>((r) => (resolveUpdated = r));
		const app = makeApp(apiKeyAuth, {
			apiTokens: {
				verify: async () => ({ id: 42, email: "alice@example.com" }),
				updateLastUsed: async (id: number) => {
					lastUsedId = id;
					resolveUpdated();
				},
			},
		});
		const res = await app.request("/api/probe", {
			headers: {
				host: "surety.hexly.ai",
				authorization: "Bearer sk_good",
			},
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			accessAuthenticated: boolean;
			accessEmail: string | null;
		};
		expect(body.accessAuthenticated).toBe(true);
		expect(body.accessEmail).toBe("alice@example.com");
		// updateLastUsed is fire-and-forget; await its completion via deferred
		// (was: setTimeout(10), which added 10ms of pure wall-time per run).
		await updated;
		expect(lastUsedId).toBe(42);
	});

	test("updateLastUsed rejection is swallowed (fire-and-forget)", async () => {
		const app = makeApp(apiKeyAuth, {
			apiTokens: {
				verify: async () => ({ id: 7, email: "bob@example.com" }),
				updateLastUsed: async () => {
					throw new Error("db unavailable");
				},
			},
		});
		const res = await app.request("/api/probe", {
			headers: {
				host: "surety.hexly.ai",
				authorization: "Bearer sk_good",
			},
		});
		expect(res.status).toBe(200);
		// give the .catch arrow a tick to execute (covers the catch handler)
		for (let i = 0; i < 3; i++) await Promise.resolve();
	});

	test("E2E_SKIP_AUTH=true bypasses auth even on prod host", async () => {
		const app = makeApp(apiKeyAuth);
		const res = await app.request(
			"/api/probe",
			{ headers: { host: "surety.hexly.ai" } },
			{ E2E_SKIP_AUTH: "true" },
		);
		expect(res.status).toBe(200);
	});

	test("spoofed Host: localhost on a CF edge request does NOT bypass auth", async () => {
		// Attacker sends Host: localhost from outside; the Worker received the
		// request via CF edge so request.cf is present. Must reject.
		const app = makeApp(apiKeyAuth, {
			apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
		});
		const req = new Request("https://surety.hexly.ai/api/probe", {
			headers: { host: "localhost" },
		});
		Object.assign(req, { cf: { colo: "SJC" } });
		const res = await app.fetch(req);
		expect(res.status).toBe(401);
	});

	test("E2E_SKIP_AUTH=*** + ENVIRONMENT=production does NOT bypass auth", async () => {
		const app = makeApp(apiKeyAuth, {
			apiTokens: { verify: async () => null, updateLastUsed: async () => {} },
		});
		const res = await app.request(
			"/api/probe",
			{ headers: { host: "surety.hexly.ai" } },
			{ E2E_SKIP_AUTH: "true", ENVIRONMENT: "production" },
		);
		expect(res.status).toBe(401);
	});

	test("E2E_SKIP_AUTH=*** + ENVIRONMENT=test still bypasses auth", async () => {
		const app = makeApp(apiKeyAuth);
		const res = await app.request(
			"/api/probe",
			{ headers: { host: "surety.hexly.ai" } },
			{ E2E_SKIP_AUTH: "true", ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(200);
	});
});

describe("accessAuth + apiKeyAuth + /api/me integration", () => {
	function buildApp(repos: unknown) {
		const app = new Hono<AppEnv>();
		app.use("*", async (c, next) => {
			c.set("repos", repos as AllRepos);
			return next();
		});
		app.use("*", accessAuth);
		app.use("*", apiKeyAuth);
		app.route("/", meRoutes);
		return app;
	}

	test("localhost host + valid Bearer token → /api/me returns email", async () => {
		// Regression: previously accessAuth short-circuited on localhost without
		// populating accessEmail, so apiKeyAuth was skipped and /api/me always
		// replied { authenticated: false } for CLI users hitting a local worker.
		const app = buildApp({
			apiTokens: {
				verify: async () => ({ id: 7, email: "cli@hexly.ai" }),
				updateLastUsed: async () => {},
			},
		});
		const res = await app.request(
			"/api/me",
			{
				headers: {
					host: "localhost:7016",
					authorization: "Bearer sk_cli",
				},
			},
			{},
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			email: string | null;
			authenticated: boolean;
		};
		expect(body.authenticated).toBe(true);
		expect(body.email).toBe("cli@hexly.ai");
	});

	test("machine host (surety-api.hexly.ai) + valid Bearer token → /api/me returns email", async () => {
		// Bearer-token clients hit the machine endpoint where accessAuth
		// short-circuits and apiKeyAuth gates the request. accessAuth requires
		// c.req.raw.cf to honour the machine-host claim, so simulate edge
		// transit on the Request object.
		const app = buildApp({
			apiTokens: {
				verify: async () => ({ id: 9, email: "prod@hexly.ai" }),
				updateLastUsed: async () => {},
			},
		});
		const req = new Request("http://localhost/api/me", {
			headers: {
				host: "surety-api.hexly.ai",
				authorization: "Bearer sk_prod",
			},
		});
		Object.assign(req, { cf: { colo: "TEST" } });
		const res = await app.request(req, undefined, {});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			email: string | null;
			authenticated: boolean;
		};
		expect(body.authenticated).toBe(true);
		expect(body.email).toBe("prod@hexly.ai");
	});
});
