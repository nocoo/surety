import { expect, test } from "./fixtures";

/**
 * Baseline auth contract for the L3 webServer.
 *
 * Production runs behind Cloudflare Access; the test environment sets
 * E2E_SKIP_AUTH=true via --var override in run-l3-server.ts. This spec
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

test("protected /api/members succeeds when E2E_SKIP_AUTH=true", async ({ request }) => {
	const res = await request.get("/api/members");
	expect(res.status()).toBe(200);
	const body = (await res.json()) as Array<{ id: number }>;
	expect(Array.isArray(body)).toBe(true);
});
