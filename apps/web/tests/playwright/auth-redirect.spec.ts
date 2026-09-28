import { expect, test } from "./fixtures";

/**
 * Baseline auth contract for the L3 webServer.
 *
 * Production runs behind Cloudflare Access; the test environment sets
 * a signed fixture identity from the native local launcher. This spec
 * documents the resulting contract:
 *   - /api/live is always reachable (no auth required)
 *   - protected routes (/api/members) succeed in SKIP mode
 *
 * A future iteration can layer in a real CF JWKS mock and verify the
 * 401/redirect path by stripping the SKIP env.
 */

test("/api/live is always reachable (no auth)", async ({ request }) => {
	const res = await request.get("/api/live");
	expect(res.status()).toBe(200);
});

test("protected /api/members accepts the signed fixture identity", async ({ request }) => {
	const res = await request.get("/api/members");
	expect(res.status()).toBe(200);
	const body = (await res.json()) as Array<{ id: number }>;
	expect(Array.isArray(body)).toBe(true);
});
