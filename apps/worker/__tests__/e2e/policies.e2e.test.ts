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

// ============================================================================
// Policy status transitions (terminate / planned-surrender / bypass guards /
// payments lockdown / reactivate). See docs/19-policy-status.md.
// ============================================================================

const CST_2026_06_22 = new Date("2026-06-22T04:00:00.000Z"); // 12:00 CST

async function seedTerminatable(env: ReturnType<typeof buildTestApp>) {
  const memberId = await seedMember(env);
  const policyId = await seedPolicy(env, memberId, "POL-T", {
    effectiveDate: "2026-01-01",
  });
  return { memberId, policyId };
}

describe("L2 E2E: POST /api/policies/:id/terminate", () => {
  test("happy path — Surrendered with reason and metadata response", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-15",
        terminationReason: "客户主动退保",
      });
      expect(r.status).toBe(200);
      const body = r.body as { status: string; terminatedAt: string; terminationReason: string };
      expect(body.status).toBe("Surrendered");
      expect(body.terminatedAt).toBe("2026-06-15");
      expect(body.terminationReason).toBe("客户主动退保");

      const get = await jsonRequest(env, "GET", `/api/policies/${policyId}`);
      const detail = get.body as {
        status: string;
        terminatedAt: string | null;
        plannedSurrenderAt: string | null;
        plannedSurrenderNote: string | null;
      };
      expect(detail.status).toBe("Surrendered");
      expect(detail.terminatedAt).toBe("2026-06-15");
      expect(detail.plannedSurrenderAt).toBeNull();
      expect(detail.plannedSurrenderNote).toBeNull();
    } finally {
      setSystemTime();
    }
  });

  test("idempotent: same terminal status second POST overwrites metadata", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-04-01",
        terminationReason: "first",
      });
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-01",
        terminationReason: "edit later",
      });
      expect(r.status).toBe(200);
      const detail = (await jsonRequest(env, "GET", `/api/policies/${policyId}`)).body as {
        terminatedAt: string;
        terminationReason: string;
      };
      expect(detail.terminatedAt).toBe("2026-06-01");
      expect(detail.terminationReason).toBe("edit later");
    } finally {
      setSystemTime();
    }
  });

  test("backfill for legacy rows: status terminal + terminatedAt null is editable via same-status POST", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      // Simulate legacy data: terminal status but missing terminatedAt.
      await env.repos.policies.update(policyId, {
        status: "Lapsed",
        terminatedAt: null,
        terminationReason: null,
      });
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Lapsed",
        terminatedAt: "2026-05-20",
      });
      expect(r.status).toBe(200);
      const detail = (await jsonRequest(env, "GET", `/api/policies/${policyId}`)).body as {
        status: string;
        terminatedAt: string;
      };
      expect(detail.status).toBe("Lapsed");
      expect(detail.terminatedAt).toBe("2026-05-20");
    } finally {
      setSystemTime();
    }
  });

  test("rejects invalid date format", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026/06/15",
      });
      expect(r.status).toBe(400);
    } finally {
      setSystemTime();
    }
  });

  test("rejects date that fails round-trip (e.g. 2026-99-99)", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-99-99",
      });
      expect(r.status).toBe(400);
    } finally {
      setSystemTime();
    }
  });

  test("rejects date before effectiveDate", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2025-12-31",
      });
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/effective date/);
    } finally {
      setSystemTime();
    }
  });

  test("rejects future date (after todayInTimeZone Asia/Shanghai)", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-07-01",
      });
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/future/);
    } finally {
      setSystemTime();
    }
  });

  test("rejects status=Active", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Active",
        terminatedAt: "2026-06-15",
      });
      expect(r.status).toBe(400);
    } finally {
      setSystemTime();
    }
  });

  test("rejects unknown policy (404)", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(env, "POST", "/api/policies/9999/terminate", {
      status: "Surrendered",
      terminatedAt: "2026-06-15",
    });
    expect(r.status).toBe(404);
  });

  test("rejects terminal-to-terminal transition (400)", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-04-01",
      });
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Claimed",
        terminatedAt: "2026-05-01",
      });
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/terminal/);
    } finally {
      setSystemTime();
    }
  });

  test("DB Active with display Expired can still terminate", async () => {
    // Past expiryDate but DB row still Active. Display layer would show
    // Expired; terminate must use DB status, not display.
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const memberId = await seedMember(env);
      const policyId = await seedPolicy(env, memberId, "POL-EXP", {
        effectiveDate: "2024-01-01",
        expiryDate: "2025-12-31",
      });
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Lapsed",
        terminatedAt: "2026-01-15",
      });
      expect(r.status).toBe(200);
    } finally {
      setSystemTime();
    }
  });

  test("payments retain DB values after terminate (no tombstone, no mutation)", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      // Seed payments manually to dodge the terminated-policy guard on
      // POST /payments — we want a pre-terminate state.
      await env.repos.payments.create({
        policyId,
        periodNumber: 1,
        dueDate: "2026-03-01",
        amount: 100,
        status: "Paid",
      });
      await env.repos.payments.create({
        policyId,
        periodNumber: 2,
        dueDate: "2026-09-01",
        amount: 100,
        status: "Pending",
      });
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-15",
      });
      const got = await jsonRequest(env, "GET", `/api/policies/${policyId}/payments`);
      const rows = (got.body as Array<{ periodNumber: number; status: string }>).slice().sort(
        (a, b) => a.periodNumber - b.periodNumber,
      );
      // DB values are untouched: read-path filtering happens at the UI layer.
      expect(rows[0]?.status).toBe("Paid");
      expect(rows[1]?.status).toBe("Pending");
    } finally {
      setSystemTime();
    }
  });

  test("terminatedAt can move forward and backward via repeated same-status POSTs", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-05-15",
      });
      // Move forward.
      let r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-15",
      });
      expect(r.status).toBe(200);
      // Move backward.
      r = await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-04-01",
      });
      expect(r.status).toBe(200);
    } finally {
      setSystemTime();
    }
  });
});

describe("L2 E2E: PUT /api/policies/:id/planned-surrender", () => {
  test("happy path: sets future date on Active policy", async () => {
    const env = buildTestApp();
    const { policyId } = await seedTerminatable(env);
    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/planned-surrender`, {
      plannedSurrenderAt: "2030-01-01",
      plannedSurrenderNote: "想退",
    });
    expect(r.status).toBe(200);
    const detail = (await jsonRequest(env, "GET", `/api/policies/${policyId}`)).body as {
      plannedSurrenderAt: string;
      plannedSurrenderNote: string;
    };
    expect(detail.plannedSurrenderAt).toBe("2030-01-01");
    expect(detail.plannedSurrenderNote).toBe("想退");
  });

  test("clears with null payload", async () => {
    const env = buildTestApp();
    const { policyId } = await seedTerminatable(env);
    await jsonRequest(env, "PUT", `/api/policies/${policyId}/planned-surrender`, {
      plannedSurrenderAt: "2030-01-01",
    });
    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/planned-surrender`, {
      plannedSurrenderAt: null,
      plannedSurrenderNote: null,
    });
    expect(r.status).toBe(200);
    const detail = (await jsonRequest(env, "GET", `/api/policies/${policyId}`)).body as {
      plannedSurrenderAt: string | null;
      plannedSurrenderNote: string | null;
    };
    expect(detail.plannedSurrenderAt).toBeNull();
    expect(detail.plannedSurrenderNote).toBeNull();
  });

  test("rejects on terminated policy (400)", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-15",
      });
      const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/planned-surrender`, {
        plannedSurrenderAt: "2030-01-01",
      });
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/Active/);
    } finally {
      setSystemTime();
    }
  });

  test("rejects invalid date format", async () => {
    const env = buildTestApp();
    const { policyId } = await seedTerminatable(env);
    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/planned-surrender`, {
      plannedSurrenderAt: "not-a-date",
    });
    expect(r.status).toBe(400);
  });

  test("rejects plannedSurrenderAt before effectiveDate", async () => {
    const env = buildTestApp();
    const { policyId } = await seedTerminatable(env);
    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/planned-surrender`, {
      plannedSurrenderAt: "2025-12-31",
    });
    expect(r.status).toBe(400);
    expect((r.body as { error: string }).error).toMatch(/effective date/);
  });

  test("terminate clears any pre-existing planned-surrender", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      await jsonRequest(env, "PUT", `/api/policies/${policyId}/planned-surrender`, {
        plannedSurrenderAt: "2030-01-01",
        plannedSurrenderNote: "想退",
      });
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-15",
      });
      const detail = (await jsonRequest(env, "GET", `/api/policies/${policyId}`)).body as {
        plannedSurrenderAt: string | null;
        plannedSurrenderNote: string | null;
      };
      expect(detail.plannedSurrenderAt).toBeNull();
      expect(detail.plannedSurrenderNote).toBeNull();
    } finally {
      setSystemTime();
    }
  });
});

describe("L2 E2E: CRUD bypass guards", () => {
  test("POST /api/policies with terminal status returns 400", async () => {
    const env = buildTestApp();
    const memberId = await seedMember(env);
    const r = await jsonRequest(env, "POST", "/api/policies", {
      applicantId: memberId,
      insuredType: "Member",
      insuredMemberId: memberId,
      category: "Health",
      insurerName: "Ins",
      productName: "Prod",
      policyNumber: "POL-Bypass-1",
      effectiveDate: "2026-01-01",
      sumAssured: 100,
      premium: 50,
      paymentFrequency: "Yearly",
      status: "Surrendered",
    });
    expect(r.status).toBe(400);
    expect((r.body as { error: string }).error).toMatch(/terminated state/);
  });

  test.each([
    ["terminatedAt", "2026-05-01"],
    ["terminationReason", "client request"],
    ["plannedSurrenderAt", "2030-01-01"],
    ["plannedSurrenderNote", "想退"],
  ] as const)(
    "POST /api/policies carrying %s returns 400",
    async (field, value) => {
      const env = buildTestApp();
      const memberId = await seedMember(env);
      const r = await jsonRequest(env, "POST", "/api/policies", {
        applicantId: memberId,
        insuredType: "Member",
        insuredMemberId: memberId,
        category: "Health",
        insurerName: "Ins",
        productName: "Prod",
        policyNumber: `POL-Bypass-meta-${field}`,
        effectiveDate: "2026-01-01",
        sumAssured: 100,
        premium: 50,
        paymentFrequency: "Yearly",
        [field]: value,
      });
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/transition endpoints/);
    },
  );

  test("PUT Active -> terminal status returns 400", async () => {
    const env = buildTestApp();
    const { policyId } = await seedTerminatable(env);
    const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
      status: "Claimed",
    });
    expect(r.status).toBe(400);
  });

  test.each([
    ["terminatedAt", "2026-05-01"],
    ["terminationReason", "sneak"],
    ["plannedSurrenderAt", "2030-01-01"],
    ["plannedSurrenderNote", "ignore me"],
  ] as const)(
    "PUT on Active carrying %s returns 400",
    async (field, value) => {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
        [field]: value,
      });
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/status metadata/);
    },
  );
});

describe("L2 E2E: payments lockdown under terminated policy", () => {
  async function seedTerminatedWithPayments(env: ReturnType<typeof buildTestApp>) {
    setSystemTime(CST_2026_06_22);
    const { policyId } = await seedTerminatable(env);
    const paid = await env.repos.payments.create({
      policyId,
      periodNumber: 1,
      dueDate: "2026-03-01",
      amount: 100,
      status: "Paid",
    });
    const pending = await env.repos.payments.create({
      policyId,
      periodNumber: 2,
      dueDate: "2026-09-01",
      amount: 100,
      status: "Pending",
    });
    await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
      status: "Surrendered",
      terminatedAt: "2026-06-15",
    });
    return { policyId, paidId: paid.id, pendingId: pending.id };
  }

  test("POST /payments after terminate returns 400", async () => {
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatedWithPayments(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/payments`, {
        periodNumber: 3,
        dueDate: "2026-12-01",
        amount: 100,
      });
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/terminated/);
    } finally {
      setSystemTime();
    }
  });

  test("POST /payments/generate after terminate returns 400", async () => {
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatedWithPayments(env);
      const r = await jsonRequest(env, "POST", `/api/policies/${policyId}/payments/generate`, {});
      expect(r.status).toBe(400);
      expect((r.body as { error: string }).error).toMatch(/terminated/);
    } finally {
      setSystemTime();
    }
  });

  test("DELETE /payments/:id after terminate returns 400", async () => {
    try {
      const env = buildTestApp();
      const { policyId, pendingId } = await seedTerminatedWithPayments(env);
      const r = await jsonRequest(env, "DELETE", `/api/policies/${policyId}/payments/${pendingId}`);
      expect(r.status).toBe(400);
    } finally {
      setSystemTime();
    }
  });

  test("DELETE /api/policies/:id (whole-policy cascade) still works for terminated", async () => {
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatedWithPayments(env);
      const r = await jsonRequest(env, "DELETE", `/api/policies/${policyId}`);
      expect(r.status).toBe(200);
    } finally {
      setSystemTime();
    }
  });

  test("PUT /payments/:id flipping Pending -> Paid returns 200", async () => {
    try {
      const env = buildTestApp();
      const { policyId, pendingId } = await seedTerminatedWithPayments(env);
      const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/payments/${pendingId}`, {
        status: "Paid",
        paidDate: "2026-06-10",
        paidAmount: 100,
      });
      expect(r.status).toBe(200);
    } finally {
      setSystemTime();
    }
  });

  test("PUT /payments/:id flipping Paid -> Pending returns 400", async () => {
    try {
      const env = buildTestApp();
      const { policyId, paidId } = await seedTerminatedWithPayments(env);
      const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/payments/${paidId}`, {
        status: "Pending",
      });
      expect(r.status).toBe(400);
    } finally {
      setSystemTime();
    }
  });

  test.each([
    ["dueDate", "2026-08-01"],
    ["amount", 999],
    ["periodNumber", 99],
  ] as const)(
    "PUT /payments/:id with structural field %s returns 400 even with status=Paid",
    async (field, value) => {
      try {
        const env = buildTestApp();
        const { policyId, pendingId } = await seedTerminatedWithPayments(env);
        const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/payments/${pendingId}`, {
          status: "Paid",
          [field]: value,
        });
        expect(r.status).toBe(400);
        expect((r.body as { error: string }).error).toMatch(/structure/);
      } finally {
        setSystemTime();
      }
    },
  );

  test("PUT /payments/:id with only {status:Paid, paidDate, paidAmount} returns 200", async () => {
    try {
      const env = buildTestApp();
      const { policyId, pendingId } = await seedTerminatedWithPayments(env);
      const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}/payments/${pendingId}`, {
        status: "Paid",
        paidDate: "2026-06-10",
        paidAmount: 100,
      });
      expect(r.status).toBe(200);
    } finally {
      setSystemTime();
    }
  });
});

describe("L2 E2E: reactivate from terminal", () => {
  test("PUT status=Active clears metadata even when body carries values", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-15",
        terminationReason: "试一下",
      });
      const r = await jsonRequest(env, "PUT", `/api/policies/${policyId}`, {
        status: "Active",
        plannedSurrenderAt: "2030-01-01",
        plannedSurrenderNote: "ignore",
        terminatedAt: "2099-01-01",
        terminationReason: "ignore",
      });
      expect(r.status).toBe(200);
      const detail = (await jsonRequest(env, "GET", `/api/policies/${policyId}`)).body as {
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
    } finally {
      setSystemTime();
    }
  });

  test("after reactivate, original Pending payment DB values intact and POST guard lifted", async () => {
    setSystemTime(CST_2026_06_22);
    try {
      const env = buildTestApp();
      const { policyId } = await seedTerminatable(env);
      const pending = await env.repos.payments.create({
        policyId,
        periodNumber: 1,
        dueDate: "2026-09-01",
        amount: 100,
        status: "Pending",
      });
      await jsonRequest(env, "POST", `/api/policies/${policyId}/terminate`, {
        status: "Surrendered",
        terminatedAt: "2026-06-15",
      });
      await jsonRequest(env, "PUT", `/api/policies/${policyId}`, { status: "Active" });

      // DB row was never modified — read still shows the original Pending entry.
      const rows = ((await jsonRequest(env, "GET", `/api/policies/${policyId}/payments`)).body as Array<{
        id: number;
        status: string;
      }>);
      const row = rows.find((p) => p.id === pending.id);
      expect(row?.status).toBe("Pending");

      // POST /payments guard lifts now that we're back to Active.
      const post = await jsonRequest(env, "POST", `/api/policies/${policyId}/payments`, {
        periodNumber: 99,
        dueDate: "2027-01-01",
        amount: 100,
      });
      expect(post.status).toBe(201);
    } finally {
      setSystemTime();
    }
  });
});
