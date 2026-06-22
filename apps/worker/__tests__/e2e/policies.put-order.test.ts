/**
 * L2 unit-style test pinning the PUT /api/policies/:id 4-step decision order
 * (see docs/19-policy-status.md §通用-post--put-禁写非-active-状态旁路封堵):
 *
 *   1. Reactivation — body.status === "Active" AND existing.status is terminal
 *      → handler must force-clear all four metadata fields, even if the body
 *        carries values for them. Returns 200.
 *   2. Terminal-status write intercept — body.status is terminal and differs
 *      from existing.status → 400.
 *   3. Status-metadata field intercept — if rules 1 and 2 do not match and
 *      any of the four metadata fields appears in the body → 400.
 *   4. Otherwise → normal PUT update path.
 */
import { describe, expect, test } from "bun:test";
import { buildTestApp, jsonRequest, type TestEnv } from "./setup";

async function seedMember(env: TestEnv) {
  const r = await jsonRequest(env, "POST", "/api/members", {
    name: "PUT-Order",
    relation: "Self",
  });
  return (r.body as { id: number }).id;
}

async function seedActivePolicy(env: TestEnv, memberId: number) {
  const r = await jsonRequest(env, "POST", "/api/policies", {
    applicantId: memberId,
    insuredType: "Member",
    insuredMemberId: memberId,
    category: "Medical",
    insurerName: "Ins",
    productName: "Prod",
    policyNumber: "PO-1",
    effectiveDate: "2026-01-01",
    sumAssured: 100,
    premium: 50,
    paymentFrequency: "Yearly",
  });
  expect(r.status).toBe(201);
  return (r.body as { id: number }).id;
}

async function terminate(env: TestEnv, policyId: number) {
  const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
    status: "Surrendered",
    terminatedAt: "2026-06-01",
    terminationReason: "test",
  });
  expect(r.status).toBe(200);
}

describe("PUT /api/policies/:id — 4-step decision order", () => {
  test("rule 1: reactivation clears all 4 metadata fields even when body carries them", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedActivePolicy(env, memberId);
    await terminate(env, policyId);

    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
      status: "Active",
      plannedSurrenderAt: "2030-01-01",
      plannedSurrenderNote: "ignore me",
      terminatedAt: "2099-01-01",
      terminationReason: "ignore me too",
    });
    expect(r.status).toBe(200);

    const get = await jsonRequest(env, "GET", `/api/policies/${policyId}`);
    expect(get.status).toBe(200);
    const detail = get.body as {
      status: string;
      terminatedAt: string | null;
      terminationReason: string | null;
      plannedSurrenderAt: string | null;
      plannedSurrenderNote: string | null;
    };
    expect(detail.status).toBe("Active");
    expect(detail.terminatedAt).toBeNull();
    expect(detail.terminationReason).toBeNull();
    expect(detail.plannedSurrenderAt).toBeNull();
    expect(detail.plannedSurrenderNote).toBeNull();
  });

  test("rule 2: Active PUT { status: 'Lapsed' } returns 400 — must use /terminate", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedActivePolicy(env, memberId);

    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
      status: "Lapsed",
    });
    expect(r.status).toBe(400);
    expect((r.body as { error: string }).error).toMatch(/terminate/);
  });

  test("rule 3: Active PUT { plannedSurrenderAt } returns 400 — metadata bypass blocked", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedActivePolicy(env, memberId);

    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
      plannedSurrenderAt: "2030-01-01",
    });
    expect(r.status).toBe(400);
    expect((r.body as { error: string }).error).toMatch(/status metadata/);
  });

  test("rule 4: normal PUT on Active policy without status/metadata succeeds", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedActivePolicy(env, memberId);

    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
      productName: "Renamed",
    });
    expect(r.status).toBe(200);
  });
});
