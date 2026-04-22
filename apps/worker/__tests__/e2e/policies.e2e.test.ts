/**
 * L2 E2E — policies CRUD plus sub-resources (payments, beneficiaries,
 * coverage-items, attachments) and dependent surfaces (dashboard, coverage-lookup)
 * driven against a real in-memory Drizzle DB.
 */
import { describe, expect, test } from "bun:test";
import { buildTestApp, jsonRequest } from "./setup";

async function seedMember(env: ReturnType<typeof buildTestApp>) {
  const r = await jsonRequest(env, "POST", "/api/members", {
    name: "投保人",
    relation: "self",
  });
  return (r.body as { id: number }).id;
}

async function seedPolicy(
  env: ReturnType<typeof buildTestApp>,
  memberId: number,
  policyNumber = "POL-100",
) {
  const r = await jsonRequest(env, "POST", "/api/policies", {
    applicantId: memberId,
    insuredType: "Member",
    insuredMemberId: memberId,
    category: "Health",
    insurerName: "T-Ins",
    productName: "T-Product",
    policyNumber,
    effectiveDate: "2026-01-01",
    sumAssured: 1000000,
    premium: 5000,
    paymentFrequency: "Yearly",
  });
  expect(r.status).toBe(201);
  return (r.body as { id: number }).id;
}

describe("L2 E2E: policies main CRUD", () => {
  test("create + list + get + update + delete cycle", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);

    const policyId = await seedPolicy(env, memberId, "POL-A");

    const ls = await jsonRequest(env, "GET", "/api/policies");
    expect((ls.body as unknown[]).length).toBe(1);

    const getR = await jsonRequest(env, "GET", `/api/policies/${policyId}`);
    expect(getR.status).toBe(200);
    expect((getR.body as { policyNumber: string }).policyNumber).toBe("POL-A");

    const upd = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
      applicantId: memberId,
      insuredType: "Member",
      insuredMemberId: memberId,
      category: "Health",
      insurerName: "T-Ins",
      productName: "T-Product-v2",
      policyNumber: "POL-A",
      effectiveDate: "2026-01-01",
      sumAssured: 2000000,
      premium: 6000,
      paymentFrequency: "Yearly",
      status: "Active",
    });
    expect(upd.status).toBe(200);
    expect((upd.body as { productName: string }).productName).toBe("T-Product-v2");

    const del = await jsonRequest(env, "DELETE", `/api/policies/${policyId}`);
    expect(del.status).toBe(200);

    const after = await jsonRequest(env, "GET", `/api/policies/${policyId}`);
    expect(after.status).toBe(404);
  });

  test("create rejects missing required fields", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(env, "POST", "/api/policies", { applicantId: 1 });
    expect(r.status).toBe(400);
  });

  test("create returns 400 when applicant does not exist", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(env, "POST", "/api/policies", {
      applicantId: 999,
      category: "Life",
      insurerName: "X",
      productName: "Y",
      policyNumber: "POL-Z",
      effectiveDate: "2026-01-01",
    });
    expect(r.status).toBe(400);
  });

  test("duplicate policy number returns 409", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    await seedPolicy(env, memberId, "POL-DUP");
    const r = await jsonRequest(env, "POST", "/api/policies", {
      applicantId: memberId,
      insuredType: "Member",
      insuredMemberId: memberId,
      category: "Health",
      insurerName: "T-Ins",
      productName: "T",
      policyNumber: "POL-DUP",
      effectiveDate: "2026-01-01",
    });
    expect(r.status).toBe(409);
  });
});

describe("L2 E2E: policy sub-resources", () => {
  test("payments add / list / update / delete", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedPolicy(env, memberId, "POL-P");

    const add = await jsonRequest(
      env,
      "POST",
      `/api/policies/${policyId}/payments`,
      {
        periodNumber: 1,
        dueDate: "2026-02-01",
        amount: 500,
        status: "Pending",
      },
    );
    expect(add.status).toBe(201);
    const paymentId = (add.body as { id: number }).id;

    const dupe = await jsonRequest(
      env,
      "POST",
      `/api/policies/${policyId}/payments`,
      { periodNumber: 1, dueDate: "2026-02-01", amount: 500 },
    );
    expect(dupe.status).toBe(409);

    const ls = await jsonRequest(env, "GET", `/api/policies/${policyId}/payments`);
    expect((ls.body as unknown[]).length).toBe(1);

    const upd = await jsonRequest(
      env,
      "PUT",
      `/api/policies/${policyId}/payments/${paymentId}`,
      { amount: 600, status: "Paid" },
    );
    expect(upd.status).toBe(200);

    const del = await jsonRequest(
      env,
      "DELETE",
      `/api/policies/${policyId}/payments/${paymentId}`,
    );
    expect(del.status).toBe(200);
  });

  test("payments generate creates expected periods", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedPolicy(env, memberId, "POL-G");

    const r = await jsonRequest(
      env,
      "POST",
      `/api/policies/${policyId}/payments/generate`,
      {},
    );
    expect(r.status).toBe(200);
    const body = r.body as { generated: number; payments: unknown[] };
    expect(body.generated).toBeGreaterThan(0);
    expect(body.payments.length).toBe(body.generated);
  });

  test("coverage-items full lifecycle", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedPolicy(env, memberId, "POL-C");

    const add = await jsonRequest(
      env,
      "POST",
      `/api/policies/${policyId}/coverage-items`,
      { name: "门诊", periodLimit: 10000 },
    );
    expect(add.status).toBe(201);
    const itemId = (add.body as { id: number }).id;

    const ls = await jsonRequest(
      env,
      "GET",
      `/api/policies/${policyId}/coverage-items`,
    );
    expect((ls.body as unknown[]).length).toBe(1);

    const get = await jsonRequest(
      env,
      "GET",
      `/api/policies/${policyId}/coverage-items/${itemId}`,
    );
    expect(get.status).toBe(200);

    const upd = await jsonRequest(
      env,
      "PUT",
      `/api/policies/${policyId}/coverage-items/${itemId}`,
      { name: "住院", periodLimit: 50000 },
    );
    expect(upd.status).toBe(200);
    expect((upd.body as { name: string }).name).toBe("住院");

    const del = await jsonRequest(
      env,
      "DELETE",
      `/api/policies/${policyId}/coverage-items/${itemId}`,
    );
    expect(del.status).toBe(200);
  });

  test("beneficiaries list returns empty when none defined", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedPolicy(env, memberId, "POL-B");
    const r = await jsonRequest(
      env,
      "GET",
      `/api/policies/${policyId}/beneficiaries`,
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });

  test("attachments list empty for fresh policy", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedPolicy(env, memberId, "POL-Att");
    const r = await jsonRequest(
      env,
      "GET",
      `/api/policies/${policyId}/attachments`,
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
});

describe("L2 E2E: dashboard + coverage-lookup", () => {
  test("dashboard returns aggregated payload", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    await seedPolicy(env, memberId, "POL-DB");
    const r = await jsonRequest(env, "GET", "/api/dashboard");
    expect(r.status).toBe(200);
    expect(typeof r.body).toBe("object");
  });

  test("coverage-lookup default member view", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    await seedPolicy(env, memberId, "POL-CL");
    const r = await jsonRequest(env, "GET", "/api/coverage-lookup?type=member");
    expect(r.status).toBe(200);
  });
});
