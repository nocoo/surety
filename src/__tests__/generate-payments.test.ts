import { describe, expect, test } from "bun:test";
import {
  generatePaymentRecords,
  type GeneratePaymentsInput,
} from "@/lib/generate-payments";

const baseInput: GeneratePaymentsInput = {
  policyId: 1,
  effectiveDate: "2024-03-15",
  paymentFrequency: "Yearly",
  totalPayments: 5,
  premium: 8000,
};

describe("generatePaymentRecords", () => {
  test("generates yearly records up to totalPayments (null cutoff = all)", () => {
    const records = generatePaymentRecords(baseInput, null, new Set());
    expect(records).toHaveLength(5);
    expect(records[0]?.dueDate).toBe("2024-03-15");
    expect(records[1]?.dueDate).toBe("2025-03-15");
    expect(records[2]?.dueDate).toBe("2026-03-15");
    expect(records[3]?.dueDate).toBe("2027-03-15");
    expect(records[4]?.dueDate).toBe("2028-03-15");
    // All should have periodNumber 1..5
    expect(records.map((r) => r.periodNumber)).toEqual([1, 2, 3, 4, 5]);
    // All should have correct amount
    for (const r of records) {
      expect(r.amount).toBe(8000);
      expect(r.policyId).toBe(1);
    }
  });

  test("generates monthly records", () => {
    const input: GeneratePaymentsInput = {
      policyId: 2,
      effectiveDate: "2025-01-10",
      paymentFrequency: "Monthly",
      totalPayments: 6,
      premium: 500,
    };
    const records = generatePaymentRecords(input, null, new Set());
    expect(records).toHaveLength(6);
    expect(records[0]?.dueDate).toBe("2025-01-10");
    expect(records[1]?.dueDate).toBe("2025-02-10");
    expect(records[5]?.dueDate).toBe("2025-06-10");
  });

  test("generates single payment record", () => {
    const input: GeneratePaymentsInput = {
      policyId: 3,
      effectiveDate: "2025-06-01",
      paymentFrequency: "Single",
      totalPayments: null,
      premium: 100000,
    };
    const records = generatePaymentRecords(input, null, new Set());
    expect(records).toHaveLength(1);
    expect(records[0]?.dueDate).toBe("2025-06-01");
    expect(records[0]?.periodNumber).toBe(1);
    expect(records[0]?.amount).toBe(100000);
  });

  test("cutoff date limits generated records", () => {
    // effectiveDate 2024-03-15, yearly, 5 periods
    // cutoff 2026-06-01 → should include 2024, 2025, 2026 (3 records)
    const cutoff = new Date("2026-06-01");
    const records = generatePaymentRecords(baseInput, cutoff, new Set());
    expect(records).toHaveLength(3);
    expect(records[2]?.dueDate).toBe("2026-03-15");
  });

  test("cutoff date before first period returns empty", () => {
    const cutoff = new Date("2023-01-01");
    const records = generatePaymentRecords(baseInput, cutoff, new Set());
    expect(records).toHaveLength(0);
  });

  test("skips existing period numbers (idempotency)", () => {
    const existing = new Set([1, 2]);
    const records = generatePaymentRecords(baseInput, null, existing);
    expect(records).toHaveLength(3);
    expect(records[0]?.periodNumber).toBe(3);
    expect(records[1]?.periodNumber).toBe(4);
    expect(records[2]?.periodNumber).toBe(5);
  });

  test("past due dates are marked Paid, future dates Pending", () => {
    // effectiveDate far in the past → first record should be Paid
    // effectiveDate far in the future → should be Pending
    const pastInput: GeneratePaymentsInput = {
      ...baseInput,
      effectiveDate: "2020-01-01",
      totalPayments: 2,
    };
    const records = generatePaymentRecords(pastInput, null, new Set());
    // 2020-01-01 is past → Paid
    expect(records[0]?.status).toBe("Paid");
    expect(records[0]?.paidDate).toBe("2020-01-01");
    expect(records[0]?.paidAmount).toBe(8000);
    // 2021-01-01 is also past → Paid
    expect(records[1]?.status).toBe("Paid");
    expect(records[1]?.paidDate).toBe("2021-01-01");

    const futureInput: GeneratePaymentsInput = {
      ...baseInput,
      effectiveDate: "2030-01-01",
      totalPayments: 1,
    };
    const futureRecords = generatePaymentRecords(futureInput, null, new Set());
    expect(futureRecords[0]?.status).toBe("Pending");
    expect(futureRecords[0]?.paidDate).toBeNull();
    expect(futureRecords[0]?.paidAmount).toBeNull();
  });

  test("combined cutoff and existing period skipping", () => {
    // 5 yearly periods from 2024-03-15
    // cutoff 2027-01-01 → periods 1-3 eligible
    // existing [1] → periods 2,3 generated
    const cutoff = new Date("2027-01-01");
    const existing = new Set([1]);
    const records = generatePaymentRecords(baseInput, cutoff, existing);
    expect(records).toHaveLength(2);
    expect(records[0]?.periodNumber).toBe(2);
    expect(records[0]?.dueDate).toBe("2025-03-15");
    expect(records[1]?.periodNumber).toBe(3);
    expect(records[1]?.dueDate).toBe("2026-03-15");
  });

  test("totalPayments null + no cutoff → only 1 record (safe default)", () => {
    const input: GeneratePaymentsInput = {
      policyId: 4,
      effectiveDate: "2025-01-01",
      paymentFrequency: "Yearly",
      totalPayments: null,
      premium: 5000,
    };
    const records = generatePaymentRecords(input, null, new Set());
    expect(records).toHaveLength(1);
    expect(records[0]?.periodNumber).toBe(1);
  });

  test("totalPayments null + cutoff → generates up to cutoff date", () => {
    // Yearly from 2024-03-24, cutoff end of 2026 → 3 records (2024, 2025, 2026)
    const input: GeneratePaymentsInput = {
      policyId: 5,
      effectiveDate: "2024-03-24",
      paymentFrequency: "Yearly",
      totalPayments: null,
      premium: 10000,
    };
    const cutoff = new Date("2026-12-31");
    const records = generatePaymentRecords(input, cutoff, new Set());
    expect(records).toHaveLength(3);
    expect(records[0]?.dueDate).toBe("2024-03-24");
    expect(records[1]?.dueDate).toBe("2025-03-24");
    expect(records[2]?.dueDate).toBe("2026-03-24");
  });

  test("totalPayments null + monthly + cutoff → generates all months", () => {
    // Monthly from 2026-01-15, cutoff 2026-03-31 → 3 records (Jan, Feb, Mar)
    const input: GeneratePaymentsInput = {
      policyId: 6,
      effectiveDate: "2026-01-15",
      paymentFrequency: "Monthly",
      totalPayments: null,
      premium: 800,
    };
    const cutoff = new Date("2026-03-31");
    const records = generatePaymentRecords(input, cutoff, new Set());
    expect(records).toHaveLength(3);
    expect(records[0]?.dueDate).toBe("2026-01-15");
    expect(records[1]?.dueDate).toBe("2026-02-15");
    expect(records[2]?.dueDate).toBe("2026-03-15");
  });

  describe("month-end edge cases", () => {
    test("Jan 31 + 1 month → Feb 28 (non-leap)", () => {
      // 2025-01-31 + 1 month = 2025-02-28 (clamped to month end)
      const input: GeneratePaymentsInput = {
        policyId: 7,
        effectiveDate: "2025-01-31",
        paymentFrequency: "Monthly",
        totalPayments: 3,
        premium: 500,
      };
      const records = generatePaymentRecords(input, null, new Set());
      expect(records).toHaveLength(3);
      expect(records[0]?.dueDate).toBe("2025-01-31");
      expect(records[1]?.dueDate).toBe("2025-02-28"); // clamped to Feb end
      expect(records[2]?.dueDate).toBe("2025-03-31");
    });

    test("Jan 31 + 1 month → Feb 29 (leap year)", () => {
      // 2024-01-31 + 1 month = 2024-02-29 (leap year)
      const input: GeneratePaymentsInput = {
        policyId: 8,
        effectiveDate: "2024-01-31",
        paymentFrequency: "Monthly",
        totalPayments: 3,
        premium: 500,
      };
      const records = generatePaymentRecords(input, null, new Set());
      expect(records).toHaveLength(3);
      expect(records[0]?.dueDate).toBe("2024-01-31");
      expect(records[1]?.dueDate).toBe("2024-02-29"); // leap year
      expect(records[2]?.dueDate).toBe("2024-03-31");
    });

    test("Mar 31 + 1 month → Apr 30", () => {
      // 2025-03-31 + 1 month = 2025-04-30 (April has 30 days)
      const input: GeneratePaymentsInput = {
        policyId: 9,
        effectiveDate: "2025-03-31",
        paymentFrequency: "Monthly",
        totalPayments: 2,
        premium: 500,
      };
      const records = generatePaymentRecords(input, null, new Set());
      expect(records).toHaveLength(2);
      expect(records[0]?.dueDate).toBe("2025-03-31");
      expect(records[1]?.dueDate).toBe("2025-04-30"); // clamped to Apr end
    });

    test("Dec 31 + 1 month → Jan 31 (year rollover)", () => {
      // 2024-12-31 + 1 month = 2025-01-31
      const input: GeneratePaymentsInput = {
        policyId: 10,
        effectiveDate: "2024-12-31",
        paymentFrequency: "Monthly",
        totalPayments: 3,
        premium: 500,
      };
      const records = generatePaymentRecords(input, null, new Set());
      expect(records).toHaveLength(3);
      expect(records[0]?.dueDate).toBe("2024-12-31");
      expect(records[1]?.dueDate).toBe("2025-01-31");
      expect(records[2]?.dueDate).toBe("2025-02-28"); // 2025 is not leap
    });
  });

  describe("leap day edge cases", () => {
    test("Feb 29 + 1 year → Feb 28 (non-leap)", () => {
      // 2024-02-29 + 1 year = 2025-02-28 (clamped to Feb end)
      const input: GeneratePaymentsInput = {
        policyId: 11,
        effectiveDate: "2024-02-29",
        paymentFrequency: "Yearly",
        totalPayments: 3,
        premium: 8000,
      };
      const records = generatePaymentRecords(input, null, new Set());
      expect(records).toHaveLength(3);
      expect(records[0]?.dueDate).toBe("2024-02-29");
      expect(records[1]?.dueDate).toBe("2025-02-28"); // non-leap year
      expect(records[2]?.dueDate).toBe("2026-02-28"); // non-leap year
    });

    test("Feb 28 + 1 year → Feb 28 (non-leap to leap)", () => {
      // 2023-02-28 + 1 year = 2024-02-28 (stays on 28th)
      const input: GeneratePaymentsInput = {
        policyId: 12,
        effectiveDate: "2023-02-28",
        paymentFrequency: "Yearly",
        totalPayments: 3,
        premium: 8000,
      };
      const records = generatePaymentRecords(input, null, new Set());
      expect(records).toHaveLength(3);
      expect(records[0]?.dueDate).toBe("2023-02-28");
      expect(records[1]?.dueDate).toBe("2024-02-28"); // leap year, but 28th stays
      expect(records[2]?.dueDate).toBe("2025-02-28"); // non-leap year
    });
  });
});
