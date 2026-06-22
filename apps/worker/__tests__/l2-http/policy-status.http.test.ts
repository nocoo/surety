/**
 * L2 HTTP — policy status transitions over real D1 + sqlite-proxy.
 *
 * Pins the same behaviour the in-memory e2e suite covers but against
 * the actual D1 binding the Worker uses in production. Plan
 * (docs/19-policy-status.md) explicitly requires this surface because
 * the project has been bitten by D1 vs bun:sqlite divergence before
 * (CLAUDE.md retrospective: NULL handling, date strings).
 *
 * Covers the high-leverage paths only — terminate happy + payment
 * lockdown + reactivation. The in-memory e2e already covers the long
 * matrix of validation cases; this suite asserts that what works
 * in-memory also works over the wire on real D1.
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

describe("L2-HTTP: terminate + reactivation over real D1", () => {
  test("POST /terminate writes status + metadata; GET reflects them", async () => {
    const memberId = await seedMember();
    const policyId = await seedActivePolicy(memberId);

    const term = await httpJson<{ status: string; terminatedAt: string; terminationReason: string | null }>(
      "POST",
      `/api/policies/${policyId}/terminate`,
      {
        status: "Surrendered",
        terminatedAt: "2024-06-15",
        terminationReason: "L2 round-trip",
      },
    );
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

    const gen = await httpJson(
      "POST",
      `/api/policies/${policyId}/payments/generate`,
      {},
    );
    expect(gen.status).toBe(400);
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
    const react = await httpJson(
      "PUT",
      `/api/policies/${policyId}`,
      {
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
      },
    );
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

describe("L2-HTTP: planned-surrender over real D1", () => {
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
