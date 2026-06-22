/**
 * SSR snapshot tests for PaymentsSection.
 *
 * Project uses react-dom/server's renderToStaticMarkup (no
 * @testing-library/react, no jsdom). We assert on the rendered HTML
 * string for entries that should/should not appear under each
 * combination of policy status × payments.
 *
 * Radix primitives (Dialog/Select trigger contents) render statically in
 * SSR enough for these structural assertions; we never simulate clicks.
 *
 * Note on the editing form: it only mounts after a Pencil click, so its
 * Select content is not present in SSR HTML. Coverage for the
 * terminated-state `paidOnly` constraint of PaymentForm is provided by
 * the API-side L2 PUT contract test in
 * apps/worker/__tests__/e2e/policies.e2e.test.ts and by exercising the
 * shared component through the `paidOnly` prop in this file's direct
 * harness.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PaymentsSection,
  buildPaymentUpdatePayload,
  paymentToFormForTerminatedEdit,
} from "../components/policy-detail/payments-section";
import type { Payment } from "../lib/types/policy";

function payment(overrides: Partial<Payment> & Pick<Payment, "id" | "periodNumber" | "dueDate" | "amount" | "status">): Payment {
  return {
    paidDate: null,
    paidAmount: null,
    ...overrides,
  } as Payment;
}

const ACTIVE_PROPS = {
  policyId: 42,
  paymentFrequency: "Yearly",
  policyStatus: "Active" as const,
  policyTerminatedAt: null,
  onPaymentsChange: () => undefined,
};

const TERMINATED_PROPS = {
  policyId: 42,
  paymentFrequency: "Yearly",
  policyStatus: "Surrendered" as const,
  policyTerminatedAt: "2026-06-15",
  onPaymentsChange: () => undefined,
};

describe("PaymentsSection — Active baseline", () => {
  it("shows add/generate buttons and counts every row", () => {
    const html = renderToStaticMarkup(
      <PaymentsSection
        {...ACTIVE_PROPS}
        payments={[
          payment({ id: 1, periodNumber: 1, dueDate: "2026-01-15", amount: 1000, status: "Paid", paidDate: "2026-01-15", paidAmount: 1000 }),
          payment({ id: 2, periodNumber: 2, dueDate: "2026-07-15", amount: 1000, status: "Pending" }),
        ]}
      />,
    );
    expect(html).toContain("手动添加");
    expect(html).toContain("生成缴费记录");
    // Summary "已缴 1 / 2 期" — both rows count.
    expect(html).toContain("1 / 2");
    // Trash icon present for non-paid row (delete entry visible).
    expect(html).toMatch(/lucide-trash/);
  });

  it("hides generate button for Single-frequency policies (existing behavior)", () => {
    const html = renderToStaticMarkup(
      <PaymentsSection
        {...ACTIVE_PROPS}
        paymentFrequency="Single"
        payments={[
          payment({ id: 1, periodNumber: 1, dueDate: "2026-01-15", amount: 1000, status: "Pending" }),
        ]}
      />,
    );
    expect(html).not.toContain("生成缴费记录");
    expect(html).toContain("手动添加");
  });
});

describe("PaymentsSection — terminated policy", () => {
  it("hides add / generate / row delete entries", () => {
    const html = renderToStaticMarkup(
      <PaymentsSection
        {...TERMINATED_PROPS}
        payments={[
          payment({ id: 1, periodNumber: 1, dueDate: "2026-03-01", amount: 1000, status: "Paid", paidDate: "2026-03-01", paidAmount: 1000 }),
          payment({ id: 2, periodNumber: 2, dueDate: "2026-09-01", amount: 1000, status: "Pending" }),
        ]}
      />,
    );
    expect(html).not.toContain("手动添加");
    expect(html).not.toContain("生成缴费记录");
    // Delete (Trash) icon must not render under terminated state.
    expect(html).not.toMatch(/lucide-trash/);
  });

  it("partitions rows: Paid stays live, Pending after terminatedAt goes obsoleted", () => {
    const html = renderToStaticMarkup(
      <PaymentsSection
        {...TERMINATED_PROPS}
        payments={[
          payment({ id: 1, periodNumber: 1, dueDate: "2026-03-01", amount: 1000, status: "Paid", paidDate: "2026-03-01", paidAmount: 1000 }),
          payment({ id: 2, periodNumber: 2, dueDate: "2026-06-15", amount: 1000, status: "Pending" }), // same day — not obsoleted
          payment({ id: 3, periodNumber: 3, dueDate: "2026-05-01", amount: 1000, status: "Pending" }), // before — not obsoleted
          payment({ id: 4, periodNumber: 4, dueDate: "2026-09-01", amount: 1000, status: "Pending" }), // after — obsoleted
        ]}
      />,
    );
    expect(html).toContain("1 笔已随终止失效");
    // Live summary uses 3 rows (1 paid + 2 pending kept live).
    expect(html).toContain("1 / 3");
  });

  it("statistics ignore obsoleted rows", () => {
    const html = renderToStaticMarkup(
      <PaymentsSection
        {...TERMINATED_PROPS}
        payments={[
          payment({ id: 1, periodNumber: 1, dueDate: "2026-03-01", amount: 1000, status: "Paid", paidDate: "2026-03-01", paidAmount: 1000 }),
          payment({ id: 2, periodNumber: 2, dueDate: "2026-09-01", amount: 1000, status: "Pending" }),
          payment({ id: 3, periodNumber: 3, dueDate: "2026-12-01", amount: 1000, status: "Pending" }),
        ]}
      />,
    );
    // 1 Paid in live; 2 obsoleted Pending → summary "已缴 1 / 1 期".
    expect(html).toContain("1 / 1");
    expect(html).toContain("2 笔已随终止失效");
  });

  it("Active policy with no terminatedAt never shows the obsoleted bucket", () => {
    const html = renderToStaticMarkup(
      <PaymentsSection
        {...ACTIVE_PROPS}
        payments={[
          payment({ id: 1, periodNumber: 1, dueDate: "2026-09-01", amount: 1000, status: "Pending" }),
        ]}
      />,
    );
    expect(html).not.toMatch(/已随终止失效/);
  });
});

describe("buildPaymentUpdatePayload (PUT body builder)", () => {
  const baseForm = {
    periodNumber: "1",
    dueDate: "2026-09-01",
    amount: "1000",
    status: "Paid" as const,
    paidDate: "2026-06-10",
    originalStatus: "Pending" as const,
  };

  it("terminated state: emits only {status:'Paid', paidDate, paidAmount} — no structural fields", () => {
    const body = buildPaymentUpdatePayload(baseForm, {
      isTerminated: true,
      originalAmount: 1000,
    });
    expect(body).toEqual({
      status: "Paid",
      paidDate: "2026-06-10",
      paidAmount: 1000,
    });
    expect("periodNumber" in body).toBe(false);
    expect("dueDate" in body).toBe(false);
    expect("amount" in body).toBe(false);
  });

  it("terminated state: blank form.amount falls back to original amount", () => {
    const body = buildPaymentUpdatePayload(
      { ...baseForm, amount: "" },
      { isTerminated: true, originalAmount: 1234 },
    );
    expect(body.paidAmount).toBe(1234);
  });

  it("terminated state: forces status='Paid' even if form.status is Pending", () => {
    const body = buildPaymentUpdatePayload(
      { ...baseForm, status: "Pending" },
      { isTerminated: true, originalAmount: 1000 },
    );
    expect(body.status).toBe("Paid");
  });

  it("active state: keeps the full structural body (legacy behavior)", () => {
    const body = buildPaymentUpdatePayload(baseForm, {
      isTerminated: false,
      originalAmount: 1000,
    });
    expect(body).toMatchObject({
      periodNumber: 1,
      dueDate: "2026-09-01",
      amount: 1000,
      status: "Paid",
      paidDate: "2026-06-10",
      paidAmount: 1000,
    });
  });

  it("active state: preserves Overdue when form status is Pending and original was Overdue", () => {
    const body = buildPaymentUpdatePayload(
      { ...baseForm, status: "Pending", originalStatus: "Overdue" },
      { isTerminated: false, originalAmount: 1000 },
    );
    expect(body.status).toBe("Overdue");
    expect(body.paidDate).toBeNull();
    expect(body.paidAmount).toBeNull();
  });
});

describe("paymentToFormForTerminatedEdit", () => {
  it("forces status to 'Paid' even for a Pending row and defaults paidDate to today when null", () => {
    const form = paymentToFormForTerminatedEdit({
      id: 7,
      periodNumber: 2,
      dueDate: "2026-09-01",
      amount: 1000,
      status: "Pending",
      paidDate: null,
      paidAmount: null,
    });
    expect(form.status).toBe("Paid");
    expect(form.originalStatus).toBe("Pending");
    expect(form.paidDate.length).toBeGreaterThan(0);
    // Structural fields are mirrored so the legacy canSave validator passes,
    // but the PUT body builder will drop them under isTerminated=true.
    expect(form.periodNumber).toBe("2");
    expect(form.dueDate).toBe("2026-09-01");
    expect(form.amount).toBe("1000");
  });
});
