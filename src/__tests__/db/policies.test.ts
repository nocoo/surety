import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@surety/db";
import { policiesRepo, membersRepo } from "@surety/db/repositories";
import type { NewPolicy } from "@surety/db/schema";

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

  beforeEach(async () => {
    resetTestDb();
    const member = await membersRepo.create({
      name: "张三",
      relation: "Self",
      birthDate: "1985-01-01",
    });
    testMemberId = member.id;
  });

  describe("create", () => {
    test("creates a policy with all fields", async () => {
      const policy = await policiesRepo.create(createTestPolicy());

      expect(policy.id).toBe(1);
      expect(policy.applicantId).toBe(testMemberId);
      expect(policy.category).toBe("Life");
      expect(policy.status).toBe("Active");
      expect(policy.sumAssured).toBe(500000);
    });

    test("creates medical policy with guaranteedRenewalYears", async () => {
      const policy = await policiesRepo.create(
        createTestPolicy({
          category: "Medical",
          productName: "蓝医保长期医疗险",
          policyNumber: "POL-MED-001",
          guaranteedRenewalYears: 20,
          waitingDays: 90,
        })
      );

      expect(policy.category).toBe("Medical");
      expect(policy.guaranteedRenewalYears).toBe(20);
      expect(policy.waitingDays).toBe(90);
    });

    test("guaranteedRenewalYears defaults to null when omitted", async () => {
      const policy = await policiesRepo.create(createTestPolicy());
      expect(policy.guaranteedRenewalYears).toBeNull();
    });

    test("creates property policy with asset", async () => {
      const policy = await policiesRepo.create(
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
    test("returns all policies", async () => {
      await policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));
      await policiesRepo.create(createTestPolicy({ policyNumber: "POL-002" }));

      expect(await policiesRepo.findAll()).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns policy when found", async () => {
      const created = await policiesRepo.create(createTestPolicy());
      const found = await policiesRepo.findById(created.id);

      expect(found?.productName).toBe("国寿福");
    });

    test("returns undefined when not found", async () => {
      expect(await policiesRepo.findById(999)).toBeUndefined();
    });
  });

  describe("findByApplicantId", () => {
    test("returns policies for applicant", async () => {
      await policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));
      await policiesRepo.create(createTestPolicy({ policyNumber: "POL-002" }));

      const policies = await policiesRepo.findByApplicantId(testMemberId);
      expect(policies).toHaveLength(2);
    });
  });

  describe("findByInsuredMemberId", () => {
    test("returns policies for insured member", async () => {
      await policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));

      const policies = await policiesRepo.findByInsuredMemberId(testMemberId);
      expect(policies).toHaveLength(1);
    });
  });

  describe("findByStatus", () => {
    test("returns policies by status", async () => {
      await policiesRepo.create(createTestPolicy({ policyNumber: "POL-001" }));
      await policiesRepo.create(
        createTestPolicy({ policyNumber: "POL-002", status: "Lapsed" })
      );

      const active = await policiesRepo.findByStatus("Active");
      expect(active).toHaveLength(1);

      const lapsed = await policiesRepo.findByStatus("Lapsed");
      expect(lapsed).toHaveLength(1);
    });
  });

  describe("update", () => {
    test("updates policy fields", async () => {
      const policy = await policiesRepo.create(createTestPolicy());

      const updated = await policiesRepo.update(policy.id, {
        status: "Surrendered",
        notes: "已退保",
      });

      expect(updated?.status).toBe("Surrendered");
      expect(updated?.notes).toBe("已退保");
    });

    test("returns undefined when not found", async () => {
      expect(await policiesRepo.update(999, { notes: "test" })).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes policy", async () => {
      const policy = await policiesRepo.create(createTestPolicy());

      expect(await policiesRepo.delete(policy.id)).toBe(true);
      expect(await policiesRepo.findById(policy.id)).toBeUndefined();
    });

    test("returns false when not found", async () => {
      expect(await policiesRepo.delete(999)).toBe(false);
    });
  });
});
