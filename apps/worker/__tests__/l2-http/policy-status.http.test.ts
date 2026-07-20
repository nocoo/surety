/**
 * L2 HTTP — policy status transitions over the local D1 binding via
 * the wrangler dev emulator. Scoped to what `scripts/run-l2-http.ts`
 * actually drives: `wrangler dev --local` boots miniflare's D1 emulator
 * (a sqlite file under `.wrangler/state-l2-http`) and the schema is
 * applied with `wrangler d1 execute --local`. This is **not** the
 * remote dev D1 — coverage of that environment still depends on
 * `bun run db:push` plus manual smoke / Playwright spec.
 *
 * Even at local-emulator level this suite catches things bun:sqlite
 * cannot, because:
 *   - it exercises the **D1 binding driver** (`packages/db/src/index.ts`
 *     createDbFromD1), not the in-memory sqlite-proxy path
 *   - requests go through real HTTP / Hono serialization, not a test
 *     client
 *   - sqlite-proxy "get" vs "all" row mapping has bitten this project
 *     before (CLAUDE.md retrospective) and only fires on the binding
 *     path
 *
 * Covers the high-leverage paths only — terminate happy + payment
 * lockdown (POST/PUT/DELETE/generate) + reactivation. The in-memory
 * e2e already covers the long matrix of validation cases; this suite
 * asserts the bits that actually do DB writes survive the wire.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { httpJson } from "./setup";

const createdMembers: number[] = [];
const createdPolicies: number[] = [];

afterAll(async () => {
	for (const id of createdPolicies) {
		await httpJson("DELETE", `/api/policies/${id}`);
	}
	for (const id of createdMembers) {
		await httpJson("DELETE", `/api/members/${id}`);
	}
});

async function seedMember(): Promise<number> {
	const tag = `ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const r = await httpJson<{ id: number }>("POST", "/api/members", {
		name: tag,
		relation: "Self",
	});
	expect(r.status).toBe(201);
	createdMembers.push(r.body.id);
	return r.body.id;
}

async function seedActivePolicy(memberId: number): Promise<number> {
	const policyNumber = `POL-PS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const r = await httpJson<{ id: number }>("POST", "/api/policies", {
		applicantId: memberId,
		insuredType: "Member",
		insuredMemberId: memberId,
		category: "Medical",
		insurerName: "L2-PS-Ins",
		productName: "L2-PS-Prod",
		policyNumber,
		effectiveDate: "2024-01-01",
		sumAssured: 1_000_000,
		premium: 5_000,
		paymentFrequency: "Yearly",
	});
	expect(r.status).toBe(201);
	createdPolicies.push(r.body.id);
	return r.body.id;
}

describe("L2-HTTP: terminate + reactivation over local D1 binding", () => {
	test("POST /terminate writes status + metadata; GET reflects them", async () => {
		const memberId = await seedMember();
		const policyId = await seedActivePolicy(memberId);

		const term = await httpJson<{
			status: string;
			terminatedAt: string;
			terminationReason: string | null;
		}>("POST", `/api/policies/${policyId}/terminate`, {
			status: "Surrendered",
			terminatedAt: "2024-06-15",
			terminationReason: "L2 round-trip",
		});
		expect(term.status).toBe(200);
		expect(term.body.status).toBe("Surrendered");
		expect(term.body.terminatedAt).toBe("2024-06-15");
		expect(term.body.terminationReason).toBe("L2 round-trip");

		const got = await httpJson<{
			status: string;
			terminatedAt: string | null;
			terminationReason: string | null;
			plannedSurrenderAt: string | null;
		}>("GET", `/api/policies/${policyId}`);
		expect(got.status).toBe(200);
		expect(got.body.status).toBe("Surrendered");
		expect(got.body.terminatedAt).toBe("2024-06-15");
		expect(got.body.terminationReason).toBe("L2 round-trip");
		expect(got.body.plannedSurrenderAt).toBeNull();
	});

	test("payment writes are locked down on a terminated policy", async () => {
		const memberId = await seedMember();
		const policyId = await seedActivePolicy(memberId);

		await httpJson("POST", `/api/policies/${policyId}/terminate`, {
			status: "Lapsed",
			terminatedAt: "2024-06-15",
		});

		const addPay = await httpJson("POST", `/api/policies/${policyId}/payments`, {
			periodNumber: 1,
			dueDate: "2025-01-01",
			amount: 5_000,
		});
		expect(addPay.status).toBe(400);

		const gen = await httpJson("POST", `/api/policies/${policyId}/payments/generate`, {});
		expect(gen.status).toBe(400);
	});

	test("PUT/DELETE payment after terminate enforces body shape and immutability", async () => {
		// Seed a Pending payment BEFORE terminating, so the terminal-state
		// PUT / DELETE guards actually have a row to act on.
		const memberId = await seedMember();
		const policyId = await seedActivePolicy(memberId);

		const addPay = await httpJson<{ id: number }>("POST", `/api/policies/${policyId}/payments`, {
			periodNumber: 1,
			dueDate: "2024-04-01",
			amount: 5_000,
		});
		expect(addPay.status).toBe(201);
		const paymentId = addPay.body.id;

		await httpJson("POST", `/api/policies/${policyId}/terminate`, {
			status: "Surrendered",
			terminatedAt: "2024-06-15",
		});

		// Pending → Paid is the allowed补录 path.
		const markPaid = await httpJson("PUT", `/api/policies/${policyId}/payments/${paymentId}`, {
			status: "Paid",
			paidDate: "2024-04-02",
		});
		expect(markPaid.status).toBe(200);

		// Paid → Pending must be rejected — the terminal-state body shape
		// only allows status="Paid" transitions.
		const revert = await httpJson("PUT", `/api/policies/${policyId}/payments/${paymentId}`, {
			status: "Pending",
		});
		expect(revert.status).toBe(400);

		// Structural fields are off-limits even with status="Paid".
		for (const [field, value] of [
			["dueDate", "2024-05-01"],
			["amount", 9_999],
			["periodNumber", 2],
		] as const) {
			const r = await httpJson("PUT", `/api/policies/${policyId}/payments/${paymentId}`, {
				status: "Paid",
				[field]: value,
			});
			expect(r.status).toBe(400);
		}

		// Row-level DELETE rejected for any payment status on a terminated
		// policy (covers Paid here; the Pending row case is covered by the
		// in-memory e2e matrix where seed → delete-before-terminate is cheap).
		const del = await httpJson("DELETE", `/api/policies/${policyId}/payments/${paymentId}`);
		expect(del.status).toBe(400);
	});

	test("reactivation via PUT clears metadata even when body carries planned-surrender", async () => {
		const memberId = await seedMember();
		const policyId = await seedActivePolicy(memberId);

		await httpJson("POST", `/api/policies/${policyId}/terminate`, {
			status: "Claimed",
			terminatedAt: "2024-06-15",
			terminationReason: "to be undone",
		});

		// Reactivate while smuggling planned-surrender fields. Rule 1
		// (reactivation force-clear) must win over rule 3 (metadata reject).
		const react = await httpJson("PUT", `/api/policies/${policyId}`, {
			applicantId: memberId,
			insuredType: "Member",
			insuredMemberId: memberId,
			category: "Medical",
			insurerName: "L2-PS-Ins",
			productName: "L2-PS-Prod",
			policyNumber: `POL-PS-${policyId}`,
			effectiveDate: "2024-01-01",
			sumAssured: 1_000_000,
			premium: 5_000,
			paymentFrequency: "Yearly",
			status: "Active",
			plannedSurrenderAt: "2099-01-01",
			plannedSurrenderNote: "should be stripped",
		});
		expect(react.status).toBe(200);

		const got = await httpJson<{
			status: string;
			terminatedAt: string | null;
			terminationReason: string | null;
			plannedSurrenderAt: string | null;
			plannedSurrenderNote: string | null;
		}>("GET", `/api/policies/${policyId}`);
		expect(got.status).toBe(200);
		expect(got.body.status).toBe("Active");
		expect(got.body.terminatedAt).toBeNull();
		expect(got.body.terminationReason).toBeNull();
		expect(got.body.plannedSurrenderAt).toBeNull();
		expect(got.body.plannedSurrenderNote).toBeNull();
	});
});

describe("L2-HTTP: planned-surrender over local D1 binding", () => {
	test("PUT /planned-surrender round-trips; clearing with null nulls both fields", async () => {
		const memberId = await seedMember();
		const policyId = await seedActivePolicy(memberId);

		const set = await httpJson("PUT", `/api/policies/${policyId}/planned-surrender`, {
			plannedSurrenderAt: "2099-01-01",
			plannedSurrenderNote: "等客服回电",
		});
		expect(set.status).toBe(200);

		const gotSet = await httpJson<{
			plannedSurrenderAt: string | null;
			plannedSurrenderNote: string | null;
		}>("GET", `/api/policies/${policyId}`);
		expect(gotSet.body.plannedSurrenderAt).toBe("2099-01-01");
		expect(gotSet.body.plannedSurrenderNote).toBe("等客服回电");

		const cleared = await httpJson("PUT", `/api/policies/${policyId}/planned-surrender`, {
			plannedSurrenderAt: null,
			plannedSurrenderNote: null,
		});
		expect(cleared.status).toBe(200);

		const gotCleared = await httpJson<{
			plannedSurrenderAt: string | null;
			plannedSurrenderNote: string | null;
		}>("GET", `/api/policies/${policyId}`);
		expect(gotCleared.body.plannedSurrenderAt).toBeNull();
		expect(gotCleared.body.plannedSurrenderNote).toBeNull();
	});
});
