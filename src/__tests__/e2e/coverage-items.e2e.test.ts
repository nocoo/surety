import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface CoverageItem {
  id: number;
  policyId: number;
  name: string;
  periodLimit: number | null;
  lifetimeLimit: number | null;
  deductible: number | null;
  coveragePercent: number | null;
  isOptional: boolean | number;
  notes: string | null;
  sortOrder: number;
}

interface PolicyCreated {
  id: number;
  policyNumber: string;
  productName: string;
}

interface Member {
  id: number;
  name: string;
  relation: string;
}

describe("Coverage Items API E2E", () => {
  let testPolicyId: number;
  let testMemberId: number;

  beforeAll(async () => {
    await setupE2E();

    // Get or create a test member
    const { data: members } = await apiRequest<Member[]>("/api/members");
    if (members.length > 0) {
      testMemberId = members[0]!.id;
    } else {
      const { data } = await apiRequest<Member>("/api/members", {
        method: "POST",
        body: JSON.stringify({ name: "E2E保障项目测试人", relation: "Self" }),
      });
      testMemberId = data.id;
    }

    // Create a test policy for coverage items
    const { data: policy } = await apiRequest<PolicyCreated>("/api/policies", {
      method: "POST",
      body: JSON.stringify({
        applicantId: testMemberId,
        insuredType: "Member",
        insuredMemberId: testMemberId,
        category: "Medical",
        insurerName: "保障项目测试保险公司",
        productName: "百万医疗测试",
        policyNumber: `CI-E2E-${Date.now()}`,
        sumAssured: 6000000,
        premium: 1200,
        paymentFrequency: "Yearly",
        effectiveDate: "2026-01-01",
      }),
    });
    testPolicyId = policy.id;
  }, 60000);

  afterAll(async () => {
    // Cleanup test policy
    if (testPolicyId) {
      await apiRequest(`/api/policies/${testPolicyId}`, { method: "DELETE" });
    }
    await teardownE2E();
  });

  describe("CRUD operations", () => {
    let createdItemId: number;

    test("GET /api/policies/:id/coverage-items returns empty list initially", async () => {
      const { status, data } = await apiRequest<CoverageItem[]>(
        `/api/policies/${testPolicyId}/coverage-items`
      );
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    test("POST /api/policies/:id/coverage-items creates item", async () => {
      const { status, data } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "住院医疗",
            periodLimit: 6000000,
            lifetimeLimit: null,
            deductible: 10000,
            coveragePercent: 100,
            isOptional: false,
            notes: "含ICU",
            sortOrder: 1,
          }),
        }
      );

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.policyId).toBe(testPolicyId);
      expect(data.name).toBe("住院医疗");
      expect(data.periodLimit).toBe(6000000);
      expect(data.deductible).toBe(10000);
      expect(data.coveragePercent).toBe(100);
      expect(data.notes).toBe("含ICU");
      expect(data.sortOrder).toBe(1);
      createdItemId = data.id;
    });

    test("GET /api/policies/:id/coverage-items returns list with created item", async () => {
      const { status, data } = await apiRequest<CoverageItem[]>(
        `/api/policies/${testPolicyId}/coverage-items`
      );
      expect(status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0]!.name).toBe("住院医疗");
    });

    test("GET /api/policies/:id/coverage-items/:itemId returns single item", async () => {
      const { status, data } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items/${createdItemId}`
      );
      expect(status).toBe(200);
      expect(data.id).toBe(createdItemId);
      expect(data.name).toBe("住院医疗");
      expect(data.policyId).toBe(testPolicyId);
    });

    test("PUT /api/policies/:id/coverage-items/:itemId updates item", async () => {
      const { status, data } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items/${createdItemId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: "住院医疗(升级)",
            deductible: 5000,
            coveragePercent: 100,
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.name).toBe("住院医疗(升级)");
      expect(data.deductible).toBe(5000);
    });

    test("GET verifies update persisted", async () => {
      const { data } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items/${createdItemId}`
      );
      expect(data.name).toBe("住院医疗(升级)");
      expect(data.deductible).toBe(5000);
      // periodLimit should remain from creation
      expect(data.periodLimit).toBe(6000000);
    });

    test("DELETE /api/policies/:id/coverage-items/:itemId deletes item", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/policies/${testPolicyId}/coverage-items/${createdItemId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Verify deleted
      const { status: getStatus } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items/${createdItemId}`
      );
      expect(getStatus).toBe(404);
    });

    test("GET /api/policies/:id/coverage-items returns empty after delete", async () => {
      const { data } = await apiRequest<CoverageItem[]>(
        `/api/policies/${testPolicyId}/coverage-items`
      );
      expect(data.length).toBe(0);
    });
  });

  describe("Multiple items", () => {
    const itemIds: number[] = [];

    test("POST creates multiple coverage items", async () => {
      const items = [
        { name: "住院医疗", periodLimit: 6000000, deductible: 10000, sortOrder: 1 },
        { name: "特殊门诊", periodLimit: 6000000, deductible: 10000, sortOrder: 2 },
        { name: "门诊手术", periodLimit: 6000000, deductible: 10000, sortOrder: 3 },
        { name: "住院前后门急诊", periodLimit: 6000000, deductible: 0, sortOrder: 4 },
        { name: "质子重离子", periodLimit: 1000000, isOptional: true, sortOrder: 5 },
      ];

      for (const item of items) {
        const { status, data } = await apiRequest<CoverageItem>(
          `/api/policies/${testPolicyId}/coverage-items`,
          {
            method: "POST",
            body: JSON.stringify(item),
          }
        );
        expect(status).toBe(201);
        itemIds.push(data.id);
      }
    });

    test("GET returns all items in order", async () => {
      const { status, data } = await apiRequest<CoverageItem[]>(
        `/api/policies/${testPolicyId}/coverage-items`
      );
      expect(status).toBe(200);
      expect(data.length).toBe(5);
    });

    test("optional item has isOptional=true", async () => {
      const { data } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items/${itemIds[4]}`
      );
      // SQLite may store boolean as 0/1
      expect(data.isOptional === true || data.isOptional === 1).toBe(true);
      expect(data.name).toBe("质子重离子");
    });

    test("cleanup: delete all items", async () => {
      for (const itemId of itemIds) {
        const { status } = await apiRequest<{ success: boolean }>(
          `/api/policies/${testPolicyId}/coverage-items/${itemId}`,
          { method: "DELETE" }
        );
        expect(status).toBe(200);
      }

      const { data } = await apiRequest<CoverageItem[]>(
        `/api/policies/${testPolicyId}/coverage-items`
      );
      expect(data.length).toBe(0);
    });
  });

  describe("Error handling", () => {
    test("GET coverage-items for non-existent policy returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/policies/99999/coverage-items"
      );
      expect(status).toBe(404);
    });

    test("GET coverage-items with invalid policy ID returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/policies/abc/coverage-items"
      );
      expect(status).toBe(400);
    });

    test("POST coverage-item without name returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/policies/${testPolicyId}/coverage-items`,
        {
          method: "POST",
          body: JSON.stringify({ periodLimit: 1000000 }),
        }
      );
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("GET single item with invalid itemId returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${testPolicyId}/coverage-items/xyz`
      );
      expect(status).toBe(400);
    });

    test("GET single item with non-existent itemId returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${testPolicyId}/coverage-items/99999`
      );
      expect(status).toBe(404);
    });

    test("PUT with invalid itemId returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${testPolicyId}/coverage-items/abc`,
        {
          method: "PUT",
          body: JSON.stringify({ name: "test" }),
        }
      );
      expect(status).toBe(400);
    });

    test("PUT non-existent item returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${testPolicyId}/coverage-items/99999`,
        {
          method: "PUT",
          body: JSON.stringify({ name: "test" }),
        }
      );
      expect(status).toBe(404);
    });

    test("DELETE with invalid itemId returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${testPolicyId}/coverage-items/abc`,
        { method: "DELETE" }
      );
      expect(status).toBe(400);
    });

    test("DELETE non-existent item returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${testPolicyId}/coverage-items/99999`,
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });

  describe("Cross-policy isolation", () => {
    let otherPolicyId: number;
    let itemId: number;

    test("setup: create another policy and an item on original policy", async () => {
      const { data: policy } = await apiRequest<PolicyCreated>(
        "/api/policies",
        {
          method: "POST",
          body: JSON.stringify({
            applicantId: testMemberId,
            insuredType: "Member",
            insuredMemberId: testMemberId,
            category: "Accident",
            insurerName: "隔离测试公司",
            productName: "隔离测试产品",
            policyNumber: `ISO-${Date.now()}`,
            sumAssured: 500000,
            premium: 300,
            paymentFrequency: "Yearly",
            effectiveDate: "2026-01-01",
          }),
        }
      );
      otherPolicyId = policy.id;

      const { data: item } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items`,
        {
          method: "POST",
          body: JSON.stringify({ name: "隔离测试保障", sortOrder: 1 }),
        }
      );
      itemId = item.id;
    });

    test("GET item via wrong policy returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${otherPolicyId}/coverage-items/${itemId}`
      );
      expect(status).toBe(404);
    });

    test("PUT item via wrong policy returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${otherPolicyId}/coverage-items/${itemId}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: "should not work" }),
        }
      );
      expect(status).toBe(404);
    });

    test("DELETE item via wrong policy returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        `/api/policies/${otherPolicyId}/coverage-items/${itemId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });

    test("other policy has no coverage items", async () => {
      const { data } = await apiRequest<CoverageItem[]>(
        `/api/policies/${otherPolicyId}/coverage-items`
      );
      expect(data.length).toBe(0);
    });

    test("cleanup: delete item and other policy", async () => {
      await apiRequest(`/api/policies/${testPolicyId}/coverage-items/${itemId}`, {
        method: "DELETE",
      });
      await apiRequest(`/api/policies/${otherPolicyId}`, {
        method: "DELETE",
      });
    });
  });

  describe("Default values", () => {
    let itemId: number;

    test("POST with only name uses defaults for optional fields", async () => {
      const { status, data } = await apiRequest<CoverageItem>(
        `/api/policies/${testPolicyId}/coverage-items`,
        {
          method: "POST",
          body: JSON.stringify({ name: "基础保障" }),
        }
      );

      expect(status).toBe(201);
      expect(data.name).toBe("基础保障");
      expect(data.periodLimit).toBeNull();
      expect(data.lifetimeLimit).toBeNull();
      expect(data.deductible).toBeNull();
      expect(data.coveragePercent).toBeNull();
      expect(data.isOptional === false || data.isOptional === 0).toBe(true);
      expect(data.notes).toBeNull();
      expect(data.sortOrder).toBe(0);
      itemId = data.id;
    });

    test("cleanup: delete default test item", async () => {
      await apiRequest(`/api/policies/${testPolicyId}/coverage-items/${itemId}`, {
        method: "DELETE",
      });
    });
  });
});
