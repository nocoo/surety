import { describe, expect, test } from "vitest";
import { generatePaymentRecords } from "../lib/generate-payments";

const POLICY = { policyId: 42, premium: 5000 } as const;

describe("generatePaymentRecords (default options)", () => {
  test("Single frequency emits exactly one period on effectiveDate", () => {
    const records = generatePaymentRecords({
      ...POLICY,
      effectiveDate: "2025-03-15",
      paymentFrequency: "Single",
      totalPayments: null,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      policyId: 42,
      periodNumber: 1,
      dueDate: "2025-03-15",
      amount: 5000,
      status: "Pending",
      paidDate: null,
      paidAmount: null,
    });
  });

  test("Yearly with totalPayments=N emits N periods at yearly cadence", () => {
    const records = generatePaymentRecords({
      ...POLICY,
      effectiveDate: "2020-06-01",
      paymentFrequency: "Yearly",
      totalPayments: 5,
    });

    expect(records.map((r) => r.dueDate)).toEqual([
      "2020-06-01",
      "2021-06-01",
      "2022-06-01",
      "2023-06-01",
      "2024-06-01",
    ]);
    expect(records.map((r) => r.periodNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  test("Monthly with totalPayments=N walks month-by-month with year rollover", () => {
    const records = generatePaymentRecords({
      ...POLICY,
      effectiveDate: "2025-11-10",
      paymentFrequency: "Monthly",
      totalPayments: 4,
    });

    expect(records.map((r) => r.dueDate)).toEqual([
      "2025-11-10",
      "2025-12-10",
      "2026-01-10",
      "2026-02-10",
    ]);
  });

  test("Monthly day clamps to last day of shorter target month", () => {
    const records = generatePaymentRecords({
      ...POLICY,
      effectiveDate: "2025-01-31",
      paymentFrequency: "Monthly",
      totalPayments: 3,
    });

    expect(records.map((r) => r.dueDate)).toEqual([
      "2025-01-31",
      "2025-02-28", // Feb non-leap → clamp
      "2025-03-31",
    ]);
  });

  test("Yearly Feb 29 clamps to Feb 28 on non-leap years", () => {
    const records = generatePaymentRecords({
      ...POLICY,
      effectiveDate: "2024-02-29",
      paymentFrequency: "Yearly",
      totalPayments: 3,
    });

    expect(records.map((r) => r.dueDate)).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
    ]);
  });

  test("every generated record is Pending with no paid fields", () => {
    const records = generatePaymentRecords({
      ...POLICY,
      effectiveDate: "1990-01-01", // far in the past
      paymentFrequency: "Yearly",
      totalPayments: 5,
    });

    expect(records).toHaveLength(5);
    for (const r of records) {
      expect(r.status).toBe("Pending");
      expect(r.paidDate).toBeNull();
      expect(r.paidAmount).toBeNull();
    }
  });

  test("totalPayments=null without cutoff degrades to a single Pending period", () => {
    const records = generatePaymentRecords({
      ...POLICY,
      effectiveDate: "2025-01-01",
      paymentFrequency: "Yearly",
      totalPayments: null,
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe("Pending");
  });
});

describe("generatePaymentRecords (cutoffDate)", () => {
  test("Yearly stops once dueDate would exceed cutoff", () => {
    const records = generatePaymentRecords(
      {
        ...POLICY,
        effectiveDate: "2020-06-01",
        paymentFrequency: "Yearly",
        totalPayments: 10,
      },
      { cutoffDate: new Date(2023, 5, 1) }, // 2023-06-01 inclusive
    );

    expect(records.map((r) => r.dueDate)).toEqual([
      "2020-06-01",
      "2021-06-01",
      "2022-06-01",
      "2023-06-01",
    ]);
  });

  test("totalPayments=null + cutoff backfills periods up to today inclusive", () => {
    const records = generatePaymentRecords(
      {
        ...POLICY,
        effectiveDate: "2024-01-15",
        paymentFrequency: "Monthly",
        totalPayments: null,
      },
      { cutoffDate: new Date(2024, 4, 15) }, // 2024-05-15
    );

    expect(records.map((r) => r.dueDate)).toEqual([
      "2024-01-15",
      "2024-02-15",
      "2024-03-15",
      "2024-04-15",
      "2024-05-15",
    ]);
  });

  test("all cutoff-generated records remain Pending without markPastAsPaid", () => {
    const records = generatePaymentRecords(
      {
        ...POLICY,
        effectiveDate: "2020-01-01",
        paymentFrequency: "Yearly",
        totalPayments: 10,
      },
      { cutoffDate: new Date(2024, 0, 1) },
    );

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.status === "Pending")).toBe(true);
    expect(records.every((r) => r.paidDate === null)).toBe(true);
    expect(records.every((r) => r.paidAmount === null)).toBe(true);
  });
});

describe("generatePaymentRecords (existingPeriodNumbers)", () => {
  test("skips periods already present in DB for idempotency", () => {
    const records = generatePaymentRecords(
      {
        ...POLICY,
        effectiveDate: "2020-01-01",
        paymentFrequency: "Yearly",
        totalPayments: 5,
      },
      { existingPeriodNumbers: new Set([1, 3]) },
    );

    expect(records.map((r) => r.periodNumber)).toEqual([2, 4, 5]);
  });

  test("repeated call with all periods present yields zero new records", () => {
    const input = {
      ...POLICY,
      effectiveDate: "2020-01-01",
      paymentFrequency: "Yearly" as const,
      totalPayments: 3,
    };
    const first = generatePaymentRecords(input);
    expect(first).toHaveLength(3);

    const second = generatePaymentRecords(input, {
      existingPeriodNumbers: new Set(first.map((r) => r.periodNumber)),
    });
    expect(second).toHaveLength(0);
  });
});

describe("generatePaymentRecords (markPastAsPaid: seed mode)", () => {
  test("past periods become Paid with paidDate/paidAmount when flag is true", () => {
    const records = generatePaymentRecords(
      {
        ...POLICY,
        effectiveDate: "1990-01-01",
        paymentFrequency: "Yearly",
        totalPayments: 3,
      },
      { markPastAsPaid: true },
    );

    expect(records).toHaveLength(3);
    for (const r of records) {
      expect(r.status).toBe("Paid");
      expect(r.paidDate).toBe(r.dueDate);
      expect(r.paidAmount).toBe(5000);
    }
  });

  test("future periods remain Pending even when flag is true", () => {
    const farFuture = new Date().getFullYear() + 5;
    const records = generatePaymentRecords(
      {
        ...POLICY,
        effectiveDate: `${farFuture}-01-01`,
        paymentFrequency: "Yearly",
        totalPayments: 2,
      },
      { markPastAsPaid: true },
    );

    expect(records).toHaveLength(2);
    for (const r of records) {
      expect(r.status).toBe("Pending");
      expect(r.paidDate).toBeNull();
      expect(r.paidAmount).toBeNull();
    }
  });
});
