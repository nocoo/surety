/**
 * L2 E2E — policies CRUD plus sub-resources (payments, beneficiaries,
 * coverage-items, attachments) and dependent surfaces (dashboard, coverage-lookup)
 * driven against a real in-memory Drizzle DB.
 */
import { describe, expect, setSystemTime, test } from "bun:test";
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
  overrides: Record<string, unknown> = {},
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
    ...overrides,
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
    const body = r.body as {
      generated: number;
      payments: Array<{ status: string; paidDate: string | null; periodNumber: number }>;
    };
    expect(body.generated).toBeGreaterThan(0);
    expect(body.payments.length).toBe(body.generated);

    // Every generated record must be Pending — the user manually marks
    // what's actually paid. None should be auto-marked as Paid.
    for (const p of body.payments) {
      expect(p.status).toBe("Pending");
      expect(p.paidDate).toBeNull();
    }
  });

  test("payments generate backfills to end-of-year, includes future periods within this year", async () => {
    // Freeze the clock at 2024-06-15 12:00 CST. With Monthly cadence and
    // effective 2024-01-15, the generator should emit all 12 months of 2024
    // (Jan-Dec) — past months are backfilled and Jul-Dec are this year's
    // upcoming periods the user should see now.
    setSystemTime(new Date("2024-06-15T04:00:00.000Z"));
    try {
      const env = buildTestApp();
      const memberId = await seedMember(env);
      const policyId = await seedPolicy(env, memberId, "POL-GP", {
        effectiveDate: "2024-01-15",
        totalPayments: 24,
        paymentFrequency: "Monthly",
      });

      const r = await jsonRequest(
        env,
        "POST",
        `/api/policies/${policyId}/payments/generate`,
        {},
      );
      expect(r.status).toBe(200);
      const body = r.body as {
        generated: number;
        payments: Array<{ status: string; periodNumber: number; dueDate: string }>;
      };

      expect(body.generated).toBe(12);
      expect(body.payments.length).toBe(12);
      expect(body.payments.every((p) => p.status === "Pending")).toBe(true);

      const sorted = [...body.payments].sort((a, b) => a.periodNumber - b.periodNumber);
      expect(sorted.map((p) => p.dueDate)).toEqual([
        "2024-01-15", "2024-02-15", "2024-03-15", "2024-04-15",
        "2024-05-15", "2024-06-15", "2024-07-15", "2024-08-15",
        "2024-09-15", "2024-10-15", "2024-11-15", "2024-12-15",
      ]);
      // No 2025 periods leaked across the year boundary.
      expect(sorted.every((p) => p.dueDate <= "2024-12-31")).toBe(true);
    } finally {
      setSystemTime();
    }
  });

  test("payments generate is idempotent — second call adds nothing", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedPolicy(env, memberId, "POL-GI", {
      effectiveDate: "2022-01-01",
      totalPayments: 10,
      paymentFrequency: "Yearly",
    });

    const first = await jsonRequest(
      env,
      "POST",
      `/api/policies/${policyId}/payments/generate`,
      {},
    );
    expect(first.status).toBe(200);
    const firstCount = (first.body as { generated: number }).generated;
    expect(firstCount).toBeGreaterThan(0);

    const second = await jsonRequest(
      env,
      "POST",
      `/api/policies/${policyId}/payments/generate`,
      {},
    );
    expect(second.status).toBe(200);
    const secondBody = second.body as { generated: number; payments: unknown[] };
    expect(secondBody.generated).toBe(0);
    expect(secondBody.payments.length).toBe(firstCount);
  });

  test("payments generate tolerates concurrent calls without unique conflict", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const policyId = await seedPolicy(env, memberId, "POL-GC", {
      effectiveDate: "2022-01-01",
      totalPayments: 10,
      paymentFrequency: "Yearly",
    });

    // Fire both calls before awaiting either, so both handlers race through
    // findByPolicyId() → createMany(). onConflictDoNothing should keep both
    // responses 200 and the final period set unique.
    const [a, b] = await Promise.all([
      jsonRequest(env, "POST", `/api/policies/${policyId}/payments/generate`, {}),
      jsonRequest(env, "POST", `/api/policies/${policyId}/payments/generate`, {}),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const aBody = a.body as { generated: number; payments: Array<{ periodNumber: number }> };
    const bBody = b.body as { generated: number; payments: Array<{ periodNumber: number }> };

    // Across both calls the union of inserted records must equal the
    // final set of periods (no duplicates, no losses).
    const finalCount = Math.max(aBody.payments.length, bBody.payments.length);
    expect(aBody.generated + bBody.generated).toBe(finalCount);

    // Persisted period numbers must be unique and contiguous from 1.
    const persisted = await jsonRequest(
      env,
      "GET",
      `/api/policies/${policyId}/payments`,
    );
    const rows = persisted.body as Array<{ periodNumber: number }>;
    const periodNumbers = rows.map((r) => r.periodNumber).sort((x, y) => x - y);
    expect(new Set(periodNumbers).size).toBe(periodNumbers.length);
    periodNumbers.forEach((p, i) => expect(p).toBe(i + 1));
  });

  test("payments generate anchors on nextDueDate when present, ignoring effectiveDate", async () => {
    // Freeze the clock so test is deterministic; cutoff → 2024-12-31.
    setSystemTime(new Date("2024-06-15T04:00:00.000Z"));
    try {
      const env = buildTestApp();
      const memberId = await seedMember(env);
      // effectiveDate sits in Jan, but nextDueDate (after a 90-day waiting
      // period) actually starts the schedule in April. The generated dates
      // must follow nextDueDate, not effectiveDate.
      const policyId = await seedPolicy(env, memberId, "POL-NDD", {
        effectiveDate: "2024-01-15",
        nextDueDate: "2024-04-15",
        totalPayments: 5,
        paymentFrequency: "Yearly",
      });

      const r = await jsonRequest(
        env,
        "POST",
        `/api/policies/${policyId}/payments/generate`,
        {},
      );
      expect(r.status).toBe(200);
      const body = r.body as {
        generated: number;
        payments: Array<{ periodNumber: number; dueDate: string }>;
      };

      // 2024-04-15 only (next 2025-04-15 is past cutoff 2024-12-31).
      expect(body.generated).toBe(1);
      const sorted = [...body.payments].sort((a, b) => a.periodNumber - b.periodNumber);
      expect(sorted).toEqual([
        expect.objectContaining({ periodNumber: 1, dueDate: "2024-04-15" }),
      ]);
    } finally {
      setSystemTime();
    }
  });

  test("payments generate falls back to effectiveDate when nextDueDate is null", async () => {
    setSystemTime(new Date("2024-06-15T04:00:00.000Z"));
    try {
      const env = buildTestApp();
      const memberId = await seedMember(env);
      const policyId = await seedPolicy(env, memberId, "POL-FB", {
        effectiveDate: "2024-03-15",
        // nextDueDate intentionally omitted
        totalPayments: 5,
        paymentFrequency: "Yearly",
      });

      const r = await jsonRequest(
        env,
        "POST",
        `/api/policies/${policyId}/payments/generate`,
        {},
      );
      expect(r.status).toBe(200);
      const body = r.body as {
        generated: number;
        payments: Array<{ periodNumber: number; dueDate: string }>;
      };

      expect(body.generated).toBe(1);
      expect(body.payments[0]?.dueDate).toBe("2024-03-15");
    } finally {
      setSystemTime();
    }
  });

  test("payments generate keeps period dueDates anchored when earlier periods already exist", async () => {
    // Yearly Monthly schedule anchored at 2024-01-15. Seed period 2 first
    // (out-of-band addition by the user), then run generate. Subsequent
    // periods must remain at their original yearly offset (3 = 2026, etc.)
    // even though period 2 was added by hand — no sliding.
    setSystemTime(new Date("2026-06-15T04:00:00.000Z"));
    try {
      const env = buildTestApp();
      const memberId = await seedMember(env);
      const policyId = await seedPolicy(env, memberId, "POL-EX", {
        effectiveDate: "2024-01-15",
        nextDueDate: "2024-01-15",
        totalPayments: 5,
        paymentFrequency: "Yearly",
      });

      // Manually insert period 2 with a slightly different dueDate to prove
      // the generator does not overwrite or shift around it.
      const seedPeriod = await jsonRequest(
        env,
        "POST",
        `/api/policies/${policyId}/payments`,
        {
          periodNumber: 2,
          dueDate: "2025-01-20",
          amount: 5000,
          status: "Paid",
          paidDate: "2025-01-20",
          paidAmount: 5000,
        },
      );
      expect(seedPeriod.status).toBe(201);

      const r = await jsonRequest(
        env,
        "POST",
        `/api/policies/${policyId}/payments/generate`,
        {},
      );
      expect(r.status).toBe(200);
      const body = r.body as {
        generated: number;
        payments: Array<{ periodNumber: number; dueDate: string; status: string }>;
      };

      // Generated: periods 1 and 3 (period 2 was seeded; period 4 = 2027 > cutoff)
      expect(body.generated).toBe(2);

      const byPeriod = new Map(body.payments.map((p) => [p.periodNumber, p]));
      expect(byPeriod.get(1)?.dueDate).toBe("2024-01-15");
      // Period 2 untouched — keeps the hand-entered date and Paid status.
      expect(byPeriod.get(2)?.dueDate).toBe("2025-01-20");
      expect(byPeriod.get(2)?.status).toBe("Paid");
      // Period 3 still anchored on Jan 15, not shifted around the seeded record.
      expect(byPeriod.get(3)?.dueDate).toBe("2026-01-15");
    } finally {
      setSystemTime();
    }
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
