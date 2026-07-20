/**
 * Unit tests for the /api/auth/cli CLI token mint endpoint.
 *
 * We test the Hono sub-app directly (not the full Worker) and inject
 * `accessAuthenticated` + `accessEmail` + `repos` via a wrapper middleware
 * to mimic what the real middleware chain produces.
 */

import type { AllRepos } from "@surety/db/repositories";
import { Hono } from "hono";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppEnv } from "../src/lib/types";
import authCliRoutes, { isLocalhostUrl } from "../src/routes/auth-cli";

type MintArgs = { email: string; name: string };

// Standard Sec-Fetch headers a top-level browser navigation produces.
// Every successful test path needs these — the endpoint now requires them.
const NAV_HEADERS = {
	"sec-fetch-mode": "navigate",
	"sec-fetch-dest": "document",
	"sec-fetch-site": "none",
} as const;

function makeApp(opts: {
	accessEmail?: string;
	accessAuthenticated?: boolean;
	/**
	 * Whether to set sessionAuthenticated upstream of the route. Defaults to
	 * true when accessEmail is supplied (the typical "user signed in via CF
	 * Access" happy path). Tests that want to exercise the Bearer-only path
	 * (machine endpoint, accessEmail populated by apiKeyAuth, but no Access
	 * session) must pass `sessionAuthenticated: false` explicitly.
	 */
	sessionAuthenticated?: boolean;
	minted?: MintArgs[];
}) {
	const app = new Hono<AppEnv>();
	app.use("*", async (c, next) => {
		if (opts.accessAuthenticated) c.set("accessAuthenticated", true);
		if (opts.accessEmail) c.set("accessEmail", opts.accessEmail);
		const sessionFlag = opts.sessionAuthenticated ?? Boolean(opts.accessEmail);
		if (sessionFlag) c.set("sessionAuthenticated", true);
		// Inject a fake `repos` object with just apiTokens.create
		// Cast to the shape consumers expect; only `create` is exercised here.
		c.set("repos", {
			apiTokens: {
				create: vi.fn((email: string, name: string) => {
					opts.minted?.push({ email, name });
					return Promise.resolve({
						token: "sk_freshly_minted",
						id: 1,
						tokenPrefix: "sk_fresh",
					});
				}),
			},
		} as AllRepos);
		return next();
	});
	app.route("/", authCliRoutes);
	return app;
}

describe("isLocalhostUrl", () => {
	test("accepts http://127.0.0.1:* and http://localhost:*", () => {
		expect(isLocalhostUrl("http://127.0.0.1:5173/cb")).toBe(true);
		expect(isLocalhostUrl("http://localhost:8080/cb")).toBe(true);
	});

	test("rejects https / non-loopback / malformed", () => {
		expect(isLocalhostUrl("https://127.0.0.1:5173/cb")).toBe(false);
		expect(isLocalhostUrl("http://example.com/cb")).toBe(false);
		expect(isLocalhostUrl("http://192.168.1.1/cb")).toBe(false);
		expect(isLocalhostUrl("not a url")).toBe(false);
		expect(isLocalhostUrl("")).toBe(false);
	});
});

describe("GET /api/auth/cli", () => {
	let minted: MintArgs[] = [];

	beforeEach(() => {
		minted = [];
	});

	test("rejects request missing callback_url with 400", async () => {
		const app = makeApp({ accessEmail: "alice@example.com", minted });
		const res = await app.request("/api/auth/cli");
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/callback_url is required/);
		expect(minted.length).toBe(0);
	});

	test("rejects non-localhost callback_url with 400", async () => {
		const app = makeApp({ accessEmail: "alice@example.com", minted });
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("https://evil.com/cb")}`,
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/localhost/);
		expect(minted.length).toBe(0);
	});

	test("rejects session-authenticated request without an Access email claim with 400", async () => {
		// Defence-in-depth: a verified Access JWT without an `email` claim
		// (misconfigured CF Access policy) must not mint an unowned token.
		const app = makeApp({ minted, sessionAuthenticated: true }); // session but no accessEmail
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{ headers: NAV_HEADERS },
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/Access session required/);
		expect(minted.length).toBe(0);
	});

	test("mints token and 302s back to callback with api_key+state+email", async () => {
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}&state=xyz`,
			{ headers: NAV_HEADERS },
		);
		expect(res.status).toBe(302);
		const loc = res.headers.get("location");
		expect(loc).toBeTruthy();
		const url = new URL(loc ?? "");
		expect(url.origin + url.pathname).toBe("http://127.0.0.1:5173/cb");
		expect(url.searchParams.get("api_key")).toBe("sk_freshly_minted");
		expect(url.searchParams.get("state")).toBe("xyz");
		expect(url.searchParams.get("email")).toBe("alice@example.com");
		expect(minted).toEqual([{ email: "alice@example.com", name: "CLI" }]);
	});

	test("redirect omits state when none was supplied", async () => {
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://localhost:9999/done")}`,
			{ headers: NAV_HEADERS },
		);
		expect(res.status).toBe(302);
		const url = new URL(res.headers.get("location") ?? "");
		expect(url.searchParams.has("state")).toBe(false);
		expect(url.searchParams.get("api_key")).toBe("sk_freshly_minted");
		expect(url.searchParams.get("email")).toBe("alice@example.com");
	});

	test("accepts `callback` as an alias of `callback_url`", async () => {
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback=${encodeURIComponent("http://127.0.0.1:5173/cb")}&state=abc`,
			{ headers: NAV_HEADERS },
		);
		expect(res.status).toBe(302);
		const url = new URL(res.headers.get("location") ?? "");
		expect(url.origin + url.pathname).toBe("http://127.0.0.1:5173/cb");
		expect(url.searchParams.get("api_key")).toBe("sk_freshly_minted");
		expect(url.searchParams.get("state")).toBe("abc");
	});

	test("rejects request with Sec-Fetch-Mode=no-cors (image/script embed) with 400", async () => {
		// Embedded contexts must never be allowed to trigger CLI token mint —
		// they would let a malicious cross-origin page silently issue a token
		// bound to the victim's CF Access cookie and 302 it to a controlled
		// loopback listener.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{
				headers: {
					"sec-fetch-mode": "no-cors",
					"sec-fetch-dest": "image",
				},
			},
		);
		expect(res.status).toBe(400);
		expect(minted.length).toBe(0);
	});

	test("rejects request with Sec-Fetch-Mode=cors (fetch/XHR) with 400", async () => {
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{
				headers: {
					"sec-fetch-mode": "cors",
					"sec-fetch-dest": "empty",
				},
			},
		);
		expect(res.status).toBe(400);
		expect(minted.length).toBe(0);
	});

	test("rejects request with Sec-Fetch-Dest=iframe with 400", async () => {
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{
				headers: {
					"sec-fetch-mode": "navigate",
					"sec-fetch-dest": "iframe",
				},
			},
		);
		expect(res.status).toBe(400);
		expect(minted.length).toBe(0);
	});

	test("accepts request with Sec-Fetch-Mode=navigate + Dest=document + Site=none", async () => {
		// Sec-Fetch-Site=none is what `openBrowser()` and browser address-bar
		// entries produce; this is the legitimate CLI happy path.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}&state=nav`,
			{
				headers: {
					"sec-fetch-mode": "navigate",
					"sec-fetch-dest": "document",
					"sec-fetch-site": "none",
				},
			},
		);
		expect(res.status).toBe(302);
		const url = new URL(res.headers.get("location") ?? "");
		expect(url.searchParams.get("api_key")).toBe("sk_freshly_minted");
		expect(url.searchParams.get("state")).toBe("nav");
		expect(minted).toEqual([{ email: "alice@example.com", name: "CLI" }]);
	});

	test("accepts request with Sec-Fetch-Site=same-origin (UI-initiated link)", async () => {
		// A user clicking a link from the surety UI itself produces same-origin.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{
				headers: {
					"sec-fetch-mode": "navigate",
					"sec-fetch-dest": "document",
					"sec-fetch-site": "same-origin",
				},
			},
		);
		expect(res.status).toBe(302);
		expect(minted.length).toBe(1);
	});

	test("rejects cross-site top-level navigation (window.open from attacker) with 400", async () => {
		// The exact attack the reviewer flagged: attacker.com opens a new tab /
		// popup pointing at /api/auth/cli with their own loopback callback. The
		// victim's CF Access cookie auto-attaches; without a Sec-Fetch-Site
		// check the request looks identical to a real CLI navigation. The site
		// header is the only signal that distinguishes them.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			"/api/auth/cli?callback_url=" +
				encodeURIComponent("http://127.0.0.1:5173/cb") +
				"&state=attacker",
			{
				headers: {
					"sec-fetch-mode": "navigate",
					"sec-fetch-dest": "document",
					"sec-fetch-site": "cross-site",
				},
			},
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/cross-site/i);
		expect(minted.length).toBe(0);
	});

	test("rejects same-site top-level navigation (no legitimate cousin-host initiator) with 400", async () => {
		// We tightened the allowlist to {none, same-origin} — there is no
		// legitimate same-site entry point for /api/auth/cli (no other
		// hexly.ai subdomain links here), so admitting same-site would widen
		// the surface to whatever cousin host could be planted on the
		// registrable domain.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{
				headers: {
					"sec-fetch-mode": "navigate",
					"sec-fetch-dest": "document",
					"sec-fetch-site": "same-site",
				},
			},
		);
		expect(res.status).toBe(400);
		expect(minted.length).toBe(0);
	});

	test("rejects request whose Sec-Fetch-Mode+Dest are present but Sec-Fetch-Site is missing", async () => {
		// A browser that sent the other two but omitted Sec-Fetch-Site is
		// anomalous — treat as cross-site to avoid leaving a bypass.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{
				headers: {
					"sec-fetch-mode": "navigate",
					"sec-fetch-dest": "document",
				},
			},
		);
		expect(res.status).toBe(400);
		expect(minted.length).toBe(0);
	});

	test("rejects Bearer-only caller (machine endpoint) — no token self-replication", async () => {
		// apiKeyAuth populates accessEmail from a valid Bearer token but never
		// sets sessionAuthenticated. The mint must refuse those callers, or a
		// leaked token could mint fresh tokens for itself in a loop that
		// survives revoking the original.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			sessionAuthenticated: false, // ← key: Bearer path, not Access path
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{ headers: NAV_HEADERS },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/Access session required/);
		expect(minted.length).toBe(0);
	});

	test("rejects clients that omit all Sec-Fetch headers (curl, old webview)", async () => {
		// The endpoint has no legitimate non-browser caller — the CLI shells
		// out to the OS default browser and never hits this URL directly.
		// Modern browsers (Chrome 76+, Firefox 90+, Safari 16.4+) always send
		// Sec-Fetch-*, so absence indicates either a header-stripping
		// intermediary or a non-browser client; both are downgrade paths we
		// refuse to honour for a token-mint endpoint.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
		);
		expect(res.status).toBe(400);
		expect(minted.length).toBe(0);
	});

	test("rejects request whose Sec-Fetch-Site is present but Mode/Dest are missing", async () => {
		// Inverse of the existing "Mode/Dest present but Site missing" case.
		// A request that only carries Sec-Fetch-Site is anomalous; the Mode
		// and Dest checks must still reject it.
		const app = makeApp({
			accessEmail: "alice@example.com",
			accessAuthenticated: true,
			minted,
		});
		const res = await app.request(
			`/api/auth/cli?callback_url=${encodeURIComponent("http://127.0.0.1:5173/cb")}`,
			{ headers: { "sec-fetch-site": "none" } },
		);
		expect(res.status).toBe(400);
		expect(minted.length).toBe(0);
	});
});
