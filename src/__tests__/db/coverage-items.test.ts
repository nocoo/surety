import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import {
  coverageItemsRepo,
  membersRepo,
  policiesRepo,
} from "@/db/repositories";
import type { NewPolicy } from "@/db/schema";

describe("coverageItemsRepo", () => {
  let testPolicyId: number;

  beforeEach(() => {
    resetTestDb();

    const member = membersRepo.create({
      name: "张三",
      relation: "Self",
      birthDate: "1985-01-01",
    });

    const policy = policiesRepo.create({
      applicantId: member.id,
      insuredType: "Member",
      insuredMemberId: member.id,
      category: "Medical",
      insurerName: "太保",
      productName: "蓝医保长期医疗险",
      policyNumber: `POL-${Date.now()}`,
      sumAssured: 4000000,
      premium: 705,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-03-27",
      expiryDate: "2026-03-26",
      guaranteedRenewalYears: 20,
    } satisfies NewPolicy);

    testPolicyId = policy.id;
  });

  describe("create", () => {
    test("creates a coverage item with all fields", () => {
      const item = coverageItemsRepo.create({
        policyId: testPolicyId,
        name: "一般医疗保险金",
        periodLimit: 4000000,
        lifetimeLimit: 8000000,
        deductible: 10000,
        coveragePercent: 100,
        isOptional: false,
        notes: "按合同约定",
        sortOrder: 0,
      });

      expect(item.id).toBe(1);
      expect(item.name).toBe("一般医疗保险金");
      expect(item.periodLimit).toBe(4000000);
      expect(item.lifetimeLimit).toBe(8000000);
      expect(item.deductible).toBe(10000);
      expect(item.coveragePercent).toBe(100);
      expect(item.isOptional).toBe(false);
      expect(item.notes).toBe("按合同约定");
      expect(item.sortOrder).toBe(0);
    });

    test("creates a coverage item with minimal fields", () => {
      const item = coverageItemsRepo.create({
        policyId: testPolicyId,
        name: "重大疾病关爱保险金",
      });

      expect(item.name).toBe("重大疾病关爱保险金");
      expect(item.periodLimit).toBeNull();
      expect(item.lifetimeLimit).toBeNull();
      expect(item.deductible).toBeNull();
      expect(item.coveragePercent).toBeNull();
      expect(item.isOptional).toBe(false);
      expect(item.sortOrder).toBe(0);
    });
  });

  describe("createMany", () => {
    test("creates multiple coverage items (real medical policy)", () => {
      const items = coverageItemsRepo.createMany([
        { policyId: testPolicyId, name: "一般医疗保险金", periodLimit: 4000000, lifetimeLimit: 8000000, sortOrder: 0 },
        { policyId: testPolicyId, name: "特定疾病医疗保险金", periodLimit: 2000000, sortOrder: 1 },
        { policyId: testPolicyId, name: "重大疾病医疗保险金", periodLimit: 4000000, sortOrder: 2 },
        { policyId: testPolicyId, name: "质子重离子医疗保险金", periodLimit: 4000000, sortOrder: 3 },
        { policyId: testPolicyId, name: "特定药品费用医疗保险金", periodLimit: 2000000, sortOrder: 4 },
        { policyId: testPolicyId, name: "外购药品及医疗器械费用医疗保险金", periodLimit: 1000000, sortOrder: 5 },
        { policyId: testPolicyId, name: "重大疾病关爱保险金", periodLimit: 10000, sortOrder: 6 },
        { policyId: testPolicyId, name: "特需医疗保险金", periodLimit: 1000000, notes: "赠险", sortOrder: 7 },
        { policyId: testPolicyId, name: "互联网在线问诊费医疗保险金", periodLimit: 2000, isOptional: true, sortOrder: 8 },
        { policyId: testPolicyId, name: "互联网药品费用医疗保险金", periodLimit: 20000, isOptional: true, sortOrder: 9 },
        { policyId: testPolicyId, name: "门急诊意外医疗保险金", periodLimit: 20000, isOptional: true, sortOrder: 10 },
        { policyId: testPolicyId, name: "门急诊疾病医疗保险金", periodLimit: 10000, isOptional: true, sortOrder: 11 },
      ]);

      expect(items).toHaveLength(12);
      expect(items[0]!.name).toBe("一般医疗保险金");
      expect(items[8]!.isOptional).toBe(true);
      expect(items[7]!.notes).toBe("赠险");
    });

    test("returns empty array for empty input", () => {
      expect(coverageItemsRepo.createMany([])).toEqual([]);
    });
  });

  describe("findByPolicyId", () => {
    test("returns all coverage items for a policy", () => {
      coverageItemsRepo.createMany([
        { policyId: testPolicyId, name: "一般医疗保险金", sortOrder: 0 },
        { policyId: testPolicyId, name: "重大疾病医疗保险金", sortOrder: 1 },
      ]);

      const items = coverageItemsRepo.findByPolicyId(testPolicyId);
      expect(items).toHaveLength(2);
    });

    test("returns empty array when no items", () => {
      expect(coverageItemsRepo.findByPolicyId(999)).toEqual([]);
    });
  });

  describe("findAll", () => {
    test("returns all coverage items", () => {
      coverageItemsRepo.create({ policyId: testPolicyId, name: "A", sortOrder: 0 });
      coverageItemsRepo.create({ policyId: testPolicyId, name: "B", sortOrder: 1 });

      expect(coverageItemsRepo.findAll()).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns coverage item when found", () => {
      const created = coverageItemsRepo.create({
        policyId: testPolicyId,
        name: "一般医疗保险金",
        periodLimit: 4000000,
        sortOrder: 0,
      });

      const found = coverageItemsRepo.findById(created.id);
      expect(found?.name).toBe("一般医疗保险金");
      expect(found?.periodLimit).toBe(4000000);
    });

    test("returns undefined when not found", () => {
      expect(coverageItemsRepo.findById(999)).toBeUndefined();
    });
  });

  describe("update", () => {
    test("updates coverage item fields", () => {
      const item = coverageItemsRepo.create({
        policyId: testPolicyId,
        name: "一般医疗保险金",
        periodLimit: 2000000,
        sortOrder: 0,
      });

      const updated = coverageItemsRepo.update(item.id, {
        periodLimit: 4000000,
        notes: "限额提升",
      });

      expect(updated?.periodLimit).toBe(4000000);
      expect(updated?.notes).toBe("限额提升");
    });

    test("returns undefined when not found", () => {
      expect(coverageItemsRepo.update(999, { name: "不存在" })).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes coverage item", () => {
      const item = coverageItemsRepo.create({
        policyId: testPolicyId,
        name: "一般医疗保险金",
        sortOrder: 0,
      });

      expect(coverageItemsRepo.delete(item.id)).toBe(true);
      expect(coverageItemsRepo.findById(item.id)).toBeUndefined();
    });

    test("returns false when not found", () => {
      expect(coverageItemsRepo.delete(999)).toBe(false);
    });
  });

  describe("deleteByPolicyId", () => {
    test("deletes all items for a policy", () => {
      coverageItemsRepo.createMany([
        { policyId: testPolicyId, name: "A", sortOrder: 0 },
        { policyId: testPolicyId, name: "B", sortOrder: 1 },
        { policyId: testPolicyId, name: "C", sortOrder: 2 },
      ]);

      const count = coverageItemsRepo.deleteByPolicyId(testPolicyId);
      expect(count).toBe(3);
      expect(coverageItemsRepo.findByPolicyId(testPolicyId)).toHaveLength(0);
    });

    test("returns 0 when no items", () => {
      expect(coverageItemsRepo.deleteByPolicyId(999)).toBe(0);
    });
  });
});
