import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface Payment {
  id: number;
  policyId: number;
  periodNumber: number;
  dueDate: string;
  amount: number;
  status: "Pending" | "Paid";
  paidDate: string | null;
  paidAmount: number | null;
}

interface Policy {
  id: number;
  policyNumber: string;
  productName: string;
}

describe("Payments API E2E", () => {
  let testPolicyId: number;

  beforeAll(async () => {
    await setupE2E();

    // Get a policy to test payments
    const { data: policies } = await apiRequest<Policy[]>("/api/policies");
    if (policies.length > 0) {
      const policy = policies[0] as Policy;
      testPolicyId = policy.id;
    }
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("GET /api/policies/:id/payments", () => {
    test("returns payments for existing policy", async () => {
      const { status, data } = await apiRequest<Payment[]>(
        `/api/policies/${testPolicyId}/payments`
      );

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("payments are sorted by period number descending", async () => {
      const { data } = await apiRequest<Payment[]>(
        `/api/policies/${testPolicyId}/payments`
      );

      if (data.length >= 2) {
        for (let i = 0; i < data.length - 1; i++) {
          const curr = data[i] as Payment;
          const next = data[i + 1] as Payment;
          expect(curr.periodNumber).toBeGreaterThanOrEqual(
            next.periodNumber
          );
        }
      }
    });

    test("payments have correct structure", async () => {
      const { data } = await apiRequest<Payment[]>(
        `/api/policies/${testPolicyId}/payments`
      );

      if (data.length > 0) {
        const payment = data[0] as Payment;
        expect(typeof payment.id).toBe("number");
        expect(typeof payment.policyId).toBe("number");
        expect(typeof payment.periodNumber).toBe("number");
        expect(typeof payment.dueDate).toBe("string");
        expect(typeof payment.amount).toBe("number");
        expect(["Pending", "Paid"]).toContain(payment.status);
      }
    });

    test("payment amounts are non-negative", async () => {
      const { data } = await apiRequest<Payment[]>(
        `/api/policies/${testPolicyId}/payments`
      );

      for (const payment of data) {
        expect(payment.amount).toBeGreaterThanOrEqual(0);
      }
    });

    test("period numbers are positive", async () => {
      const { data } = await apiRequest<Payment[]>(
        `/api/policies/${testPolicyId}/payments`
      );

      for (const payment of data) {
        expect(payment.periodNumber).toBeGreaterThan(0);
      }
    });
  });

  describe("Error handling", () => {
    test("returns 400 for invalid policy id", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/policies/invalid/payments"
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("returns empty array for non-existent policy", async () => {
      const { status, data } = await apiRequest<Payment[]>(
        "/api/policies/99999/payments"
      );

      // API returns empty array for non-existent policy (not 404)
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    test("POST returns 409 for duplicate period number", async () => {
      // First, create a payment
      const { status: createStatus } = await apiRequest<Payment>(
        `/api/policies/${testPolicyId}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            dueDate: "2026-01-01",
            amount: 1000,
            periodNumber: 999,
          }),
        }
      );
      expect(createStatus).toBe(201);

      // Try to create another payment with the same period number
      const { status: dupStatus, data: dupData } = await apiRequest<{
        error: string;
      }>(
        `/api/policies/${testPolicyId}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            dueDate: "2026-01-01",
            amount: 2000,
            periodNumber: 999,
          }),
        }
      );
      expect(dupStatus).toBe(409);
      expect(dupData.error).toContain("999");
    });
  });

  describe("Payment status verification", () => {
    test("first payment is typically paid", async () => {
      const { data } = await apiRequest<Payment[]>(
        `/api/policies/${testPolicyId}/payments`
      );

      if (data.length > 0) {
        // Find the first period payment
        const sortedAsc = [...data].sort(
          (a, b) => a.periodNumber - b.periodNumber
        );
        const firstPayment = sortedAsc[0];
        // First payment is typically paid in seed data
        expect(firstPayment?.status).toBe("Paid");
      }
    });

    test("future payments are pending", async () => {
      const { data } = await apiRequest<Payment[]>(
        `/api/policies/${testPolicyId}/payments`
      );

      const pendingPayments = data.filter((p) => p.status === "Pending");
      for (const payment of pendingPayments) {
        // Pending payments should not have paidDate
        expect(payment.paidDate).toBeNull();
      }
    });
  });
});
