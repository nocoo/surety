import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import { policiesRepo, membersRepo } from "@/db/repositories";
import type { NewPolicy } from "@/db/schema";

describe("policiesRepo", () => {
  let testMemberId: number;

  const createTestPolicy = (overrides: Partial<NewPolicy> = {}): NewPolicy => ({
    applicantId: testMemberId,
    insuredType: "Member",
    insuredMemberId: testMemberId,
    category: "Life",
    insurerName: "中国人寿",
    productName: "国寿福",
    policyNumber: `POL-${Date.now()}-${Math.random()}`,
    sumAssured: 500000,
    premium: 10000,
    paymentFrequency: "Yearly",
    paymentYears: 20,
    totalPayments: 20,
    effectiveDate: "2024-01-01",
    ...overrides,
  });

  beforeEach(() => {
    resetTestDb();
    const member = membersRepo.create({
      name: "张三",
      relation: "Self",
      birthDate: "1985-01-01",
    });
    testMemberId = member.id;
  });

  describe("create", () => {
    test("creates a policy with all fields", () => {
      const policy = policiesRepo.create(createTestPolicy());

      expect(policy.id).toBe(1);
      expect(policy.applicantId).toBe(testMemberId);
      expect(policy.category).toBe("Life");
      expect(policy.status).toBe("Active");
      expect(policy.sumAssured).toBe(500000);
    });

    test("creates property policy with asset", () => {
      const policy = policiesRepo.create(
        createTestPolicy({
          insuredType: "Asset",
          insuredMemberId: null,
          insuredAssetId: 1,
          category: "Property",
        })
      );

      expect(policy.insuredType).toBe("Asset");
      expect(policy.category).toBe("Property");
    });
  });

  describe("findAll", () => {
    test("returns all policies", () => {
      policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));
      policiesRepo.create(createTestPolicy({ policyNumber: "POL-002" }));

      expect(policiesRepo.findAll()).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns policy when found", () => {
      const created = policiesRepo.create(createTestPolicy());
      const found = policiesRepo.findById(created.id);

      expect(found?.productName).toBe("国寿福");
    });

    test("returns undefined when not found", () => {
      expect(policiesRepo.findById(999)).toBeUndefined();
    });
  });

  describe("findByApplicantId", () => {
    test("returns policies for applicant", () => {
      policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));
      policiesRepo.create(createTestPolicy({ policyNumber: "POL-002" }));

      const policies = policiesRepo.findByApplicantId(testMemberId);
      expect(policies).toHaveLength(2);
    });
  });

  describe("findByInsuredMemberId", () => {
    test("returns policies for insured member", () => {
      policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));

      const policies = policiesRepo.findByInsuredMemberId(testMemberId);
      expect(policies).toHaveLength(1);
    });
  });

  describe("findByStatus", () => {
    test("returns policies by status", () => {
      policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));
      policiesRepo.create(
        createTestPolicy({ policyNumber: "POL-002", status: "Lapsed" })
      );

      const active = policiesRepo.findByStatus("Active");
      expect(active).toHaveLength(1);

      const lapsed = policiesRepo.findByStatus("Lapsed");
      expect(lapsed).toHaveLength(1);
    });
  });

  describe("update", () => {
    test("updates policy fields", () => {
      const policy = policiesRepo.create(createTestPolicy());

      const updated = policiesRepo.update(policy.id, {
        status: "Surrendered",
        notes: "已退保",
      });

      expect(updated?.status).toBe("Surrendered");
      expect(updated?.notes).toBe("已退保");
    });

    test("returns undefined when not found", () => {
      expect(policiesRepo.update(999, { notes: "test" })).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes policy", () => {
      const policy = policiesRepo.create(createTestPolicy());

      expect(policiesRepo.delete(policy.id)).toBe(true);
      expect(policiesRepo.findById(policy.id)).toBeUndefined();
    });

    test("returns false when not found", () => {
      expect(policiesRepo.delete(999)).toBe(false);
    });
  });
});
