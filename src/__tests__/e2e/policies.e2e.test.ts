import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface PolicyListItem {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  category: string;
  status: string;
}

interface PolicyCreated {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  category: string;
  status: string;
}

interface Member {
  id: number;
  name: string;
  relation: string;
}

describe("Policies API E2E", () => {
  let testMemberId: number;

  beforeAll(async () => {
    await setupE2E();

    const { data: members } = await apiRequest<Member[]>("/api/members");
    if (members.length > 0) {
      testMemberId = members[0]!.id;
    } else {
      const { data } = await apiRequest<Member>("/api/members", {
        method: "POST",
        body: JSON.stringify({
          name: "E2E测试投保人",
          relation: "Self",
        }),
      });
      testMemberId = data.id;
    }
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("CRUD operations", () => {
    let createdPolicyId: number;

    test("GET /api/policies returns list", async () => {
      const { status, data } = await apiRequest<PolicyListItem[]>(
        "/api/policies"
      );
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/policies creates new policy", async () => {
      const newPolicy = {
        applicantId: testMemberId,
        insuredType: "Member",
        insuredMemberId: testMemberId,
        category: "Life",
        insurerName: "E2E测试保险公司",
        productName: "E2E测试产品",
        policyNumber: `E2E-${Date.now()}`,
        sumAssured: 500000,
        premium: 10000,
        paymentFrequency: "Yearly",
        effectiveDate: "2026-01-01",
      };

      const { status, data } = await apiRequest<PolicyCreated>("/api/policies", {
        method: "POST",
        body: JSON.stringify(newPolicy),
      });

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.productName).toBe("E2E测试产品");
      expect(data.insurerName).toBe("E2E测试保险公司");
      expect(data.category).toBe("Life");
      createdPolicyId = data.id;
    });

    test("GET /api/policies/:id returns single policy", async () => {
      const { status, data } = await apiRequest<PolicyListItem>(
        `/api/policies/${createdPolicyId}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(createdPolicyId);
      expect(data.productName).toBe("E2E测试产品");
    });

    test("PUT /api/policies/:id updates policy", async () => {
      const { status, data } = await apiRequest<PolicyCreated>(
        `/api/policies/${createdPolicyId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            productName: "E2E更新产品",
            insurerName: "E2E更新保险公司",
            premium: 12000,
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.productName).toBe("E2E更新产品");
      expect(data.insurerName).toBe("E2E更新保险公司");
    });

    test("DELETE /api/policies/:id deletes policy", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/policies/${createdPolicyId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest<PolicyListItem>(
        `/api/policies/${createdPolicyId}`
      );
      expect(getStatus).toBe(404);
    });
  });

  describe("Error handling", () => {
    test("POST /api/policies with missing fields returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/policies",
        {
          method: "POST",
          body: JSON.stringify({ productName: "只有产品名" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("GET /api/policies/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/policies/invalid"
      );
      expect(status).toBe(400);
    });

    test("GET /api/policies/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/policies/99999"
      );
      expect(status).toBe(404);
    });

    test("PUT /api/policies/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/policies/99999",
        {
          method: "PUT",
          body: JSON.stringify({ productName: "不存在" }),
        }
      );
      expect(status).toBe(404);
    });

    test("DELETE /api/policies/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/policies/99999",
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });
});
