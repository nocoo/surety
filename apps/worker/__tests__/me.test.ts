/**
 * /api/me returns the Access-authenticated user's email so the sidebar
 * can show it. We either read the email from the context var accessAuth
 * stashed earlier, or (fallback) base64-decode the JWT payload.
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppEnv } from "../src/lib/types";
import meRoutes, { decodeJwtPayload } from "../src/routes/me";

function makeJwt(payload: Record<string, unknown>): string {
	const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${header}.${body}.signature`;
}

function makeApp(ctxEmail?: string) {
	const app = new Hono<AppEnv>();
	if (ctxEmail !== undefined) {
		app.use("*", async (c, next) => {
			c.set("accessEmail", ctxEmail);
			return next();
		});
	}
	app.route("/", meRoutes);
	return app;
}

describe("decodeJwtPayload", () => {
	test("parses a well-formed JWT body", () => {
		const jwt = makeJwt({ email: "a@b.com", name: "Alice" });
		const p = decodeJwtPayload(jwt);
		expect(p?.email).toBe("a@b.com");
		expect(p?.name).toBe("Alice");
	});

	test("returns null for malformed input", () => {
		expect(decodeJwtPayload("not.a.jwt.extra")).toBeNull();
		expect(decodeJwtPayload("only-one-part")).toBeNull();
	});

	test("returns null when middle segment is not valid base64-JSON", () => {
		// 3 parts so length check passes, but middle decodes to non-JSON text
		// base64('hello world') = 'aGVsbG8gd29ybGQ' (URL-safe friendly)
		expect(decodeJwtPayload("aaa.aGVsbG8gd29ybGQ.ccc")).toBeNull();
	});
});

describe("GET /api/me", () => {
	const fetchMock = vi.fn(
		async () => new Response(JSON.stringify({ name: null, avatar: null }), { status: 200 }),
	);

	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		fetchMock.mockReset();
		fetchMock.mockImplementation(
			async () => new Response(JSON.stringify({ name: null, avatar: null }), { status: 200 }),
		);
	});

	test("returns authenticated:false when no JWT and no ctx email", async () => {
		const app = makeApp();
		const res = await app.request("/api/me");
		const body = (await res.json()) as { email: string | null; authenticated: boolean };
		expect(body.authenticated).toBe(false);
		expect(body.email).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("uses accessEmail ctx var when present", async () => {
		const app = makeApp("zheng@hexly.ai");
		const res = await app.request("/api/me");
		const body = (await res.json()) as {
			email: string;
			name: string;
			avatar: string | null;
			authenticated: boolean;
		};
		expect(body.authenticated).toBe(true);
		expect(body.email).toBe("zheng@hexly.ai");
		expect(body.name).toBe("zheng");
		expect(body.avatar).toBeNull();
	});

	test("prefers author profile name and avatar when the lookup hits", async () => {
		fetchMock.mockImplementation(
			async () =>
				new Response(
					JSON.stringify({ name: "Zheng Li", avatar: "https://img.example/avatar-80.jpg" }),
					{ status: 200 },
				),
		);
		const app = makeApp("architie@gmail.com");
		const res = await app.request("/api/me");
		const body = (await res.json()) as {
			email: string;
			name: string;
			avatar: string | null;
			authenticated: boolean;
		};
		expect(body.name).toBe("Zheng Li");
		expect(body.avatar).toBe("https://img.example/avatar-80.jpg");
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
			"hash=7ba563171c26fb9b82e9f7750840c0455602eb35025192027230bcb40aae1217",
		);
	});

	test("falls back to decoding Cf-Access-Jwt-Assertion header", async () => {
		const app = makeApp();
		const jwt = makeJwt({ email: "bob@example.com", name: "Bob" });
		const res = await app.request("/api/me", {
			headers: { "Cf-Access-Jwt-Assertion": jwt },
		});
		const body = (await res.json()) as { email: string; name: string; authenticated: boolean };
		expect(body.authenticated).toBe(true);
		expect(body.email).toBe("bob@example.com");
		expect(body.name).toBe("Bob");
	});

	test("keeps local-part name when author profile returns 429", async () => {
		fetchMock.mockImplementation(async () => new Response("slow down", { status: 429 }));
		const app = makeApp("zheng@hexly.ai");
		const res = await app.request("/api/me");
		const body = (await res.json()) as { name: string; avatar: string | null };
		expect(body.name).toBe("zheng");
		expect(body.avatar).toBeNull();
	});

	test("returns authenticated:false when JWT header decodes to null", async () => {
		const app = makeApp();
		const res = await app.request("/api/me", {
			headers: { "Cf-Access-Jwt-Assertion": "aaa.aGVsbG8gd29ybGQ.ccc" },
		});
		const body = (await res.json()) as { email: string | null; authenticated: boolean };
		expect(body.authenticated).toBe(false);
		expect(body.email).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
