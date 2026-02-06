import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import {
  beneficiariesRepo,
  paymentsRepo,
  cashValuesRepo,
  policyExtensionsRepo,
  settingsRepo,
  membersRepo,
  policiesRepo,
} from "@/db/repositories";
import type { NewPolicy } from "@/db/schema";

describe("Other Repositories", () => {
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
      category: "Life",
      insurerName: "中国人寿",
      productName: "国寿福",
      policyNumber: `POL-${Date.now()}`,
      sumAssured: 500000,
      premium: 10000,
      paymentFrequency: "Yearly",
      paymentYears: 20,
      totalPayments: 20,
      effectiveDate: "2024-01-01",
    } satisfies NewPolicy);

    testPolicyId = policy.id;
  });

  describe("beneficiariesRepo", () => {
    test("CRUD operations", () => {
      const b = beneficiariesRepo.create({
        policyId: testPolicyId,
        externalName: "张小明",
        sharePercent: 100,
        rankOrder: 1,
      });
      expect(b.id).toBe(1);

      expect(beneficiariesRepo.findAll()).toHaveLength(1);

      expect(beneficiariesRepo.findById(b.id)?.externalName).toBe("张小明");
      expect(beneficiariesRepo.findById(999)).toBeUndefined();

      expect(beneficiariesRepo.findByPolicyId(testPolicyId)).toHaveLength(1);

      const updated = beneficiariesRepo.update(b.id, { sharePercent: 50 });
      expect(updated?.sharePercent).toBe(50);
      expect(beneficiariesRepo.update(999, { sharePercent: 50 })).toBeUndefined();

      expect(beneficiariesRepo.delete(b.id)).toBe(true);
      expect(beneficiariesRepo.delete(999)).toBe(false);
    });

    test("deleteByPolicyId", () => {
      beneficiariesRepo.create({
        policyId: testPolicyId,
        externalName: "B1",
        sharePercent: 50,
        rankOrder: 1,
      });
      beneficiariesRepo.create({
        policyId: testPolicyId,
        externalName: "B2",
        sharePercent: 50,
        rankOrder: 2,
      });

      expect(beneficiariesRepo.deleteByPolicyId(testPolicyId)).toBe(2);
      expect(beneficiariesRepo.findByPolicyId(testPolicyId)).toHaveLength(0);
    });
  });

  describe("paymentsRepo", () => {
    test("CRUD operations", () => {
      const p = paymentsRepo.create({
        policyId: testPolicyId,
        periodNumber: 1,
        dueDate: "2024-01-01",
        amount: 10000,
      });
      expect(p.id).toBe(1);
      expect(p.status).toBe("Pending");

      expect(paymentsRepo.findAll()).toHaveLength(1);

      expect(paymentsRepo.findById(p.id)?.amount).toBe(10000);
      expect(paymentsRepo.findById(999)).toBeUndefined();

      expect(paymentsRepo.findByPolicyId(testPolicyId)).toHaveLength(1);

      expect(paymentsRepo.findByStatus("Pending")).toHaveLength(1);

      const updated = paymentsRepo.update(p.id, {
        status: "Paid",
        paidDate: "2024-01-05",
        paidAmount: 10000,
      });
      expect(updated?.status).toBe("Paid");
      expect(paymentsRepo.update(999, { status: "Paid" })).toBeUndefined();

      expect(paymentsRepo.delete(p.id)).toBe(true);
      expect(paymentsRepo.delete(999)).toBe(false);
    });

    test("createMany", () => {
      const payments = paymentsRepo.createMany([
        { policyId: testPolicyId, periodNumber: 1, dueDate: "2024-01-01", amount: 10000 },
        { policyId: testPolicyId, periodNumber: 2, dueDate: "2025-01-01", amount: 10000 },
      ]);
      expect(payments).toHaveLength(2);
    });

    test("deleteByPolicyId", () => {
      paymentsRepo.createMany([
        { policyId: testPolicyId, periodNumber: 1, dueDate: "2024-01-01", amount: 10000 },
        { policyId: testPolicyId, periodNumber: 2, dueDate: "2025-01-01", amount: 10000 },
      ]);

      expect(paymentsRepo.deleteByPolicyId(testPolicyId)).toBe(2);
    });
  });

  describe("cashValuesRepo", () => {
    test("CRUD operations", () => {
      const cv = cashValuesRepo.create({
        policyId: testPolicyId,
        policyYear: 1,
        value: 5000,
      });
      expect(cv.id).toBe(1);

      expect(cashValuesRepo.findAll()).toHaveLength(1);

      expect(cashValuesRepo.findById(cv.id)?.value).toBe(5000);
      expect(cashValuesRepo.findById(999)).toBeUndefined();

      expect(cashValuesRepo.findByPolicyId(testPolicyId)).toHaveLength(1);

      const updated = cashValuesRepo.update(cv.id, { value: 6000 });
      expect(updated?.value).toBe(6000);
      expect(cashValuesRepo.update(999, { value: 100 })).toBeUndefined();

      expect(cashValuesRepo.delete(cv.id)).toBe(true);
      expect(cashValuesRepo.delete(999)).toBe(false);
    });

    test("createMany", () => {
      const cvs = cashValuesRepo.createMany([
        { policyId: testPolicyId, policyYear: 1, value: 5000 },
        { policyId: testPolicyId, policyYear: 2, value: 10000 },
      ]);
      expect(cvs).toHaveLength(2);
    });

    test("deleteByPolicyId", () => {
      cashValuesRepo.createMany([
        { policyId: testPolicyId, policyYear: 1, value: 5000 },
        { policyId: testPolicyId, policyYear: 2, value: 10000 },
      ]);

      expect(cashValuesRepo.deleteByPolicyId(testPolicyId)).toBe(2);
    });
  });

  describe("policyExtensionsRepo", () => {
    test("CRUD operations", () => {
      const ext = policyExtensionsRepo.create({
        policyId: testPolicyId,
        data: JSON.stringify({ deductible: 10000 }),
      });
      expect(ext.id).toBe(1);

      expect(policyExtensionsRepo.findAll()).toHaveLength(1);

      expect(policyExtensionsRepo.findById(ext.id)?.data).toContain("deductible");
      expect(policyExtensionsRepo.findById(999)).toBeUndefined();

      expect(policyExtensionsRepo.findByPolicyId(testPolicyId)?.data).toContain(
        "deductible"
      );

      const updated = policyExtensionsRepo.update(ext.id, {
        data: JSON.stringify({ deductible: 20000 }),
      });
      expect(updated?.data).toContain("20000");
      expect(policyExtensionsRepo.update(999, { data: "{}" })).toBeUndefined();

      expect(policyExtensionsRepo.delete(ext.id)).toBe(true);
      expect(policyExtensionsRepo.delete(999)).toBe(false);
    });

    test("upsertByPolicyId creates new", () => {
      const ext = policyExtensionsRepo.upsertByPolicyId(testPolicyId, {
        coverage: "全险",
      });
      expect(ext.data).toContain("全险");
    });

    test("upsertByPolicyId updates existing", () => {
      policyExtensionsRepo.create({
        policyId: testPolicyId,
        data: JSON.stringify({ old: true }),
      });

      const ext = policyExtensionsRepo.upsertByPolicyId(testPolicyId, {
        new: true,
      });
      expect(ext.data).toContain("new");
      expect(ext.data).not.toContain("old");
    });

    test("parseData", () => {
      const ext = policyExtensionsRepo.create({
        policyId: testPolicyId,
        data: JSON.stringify({ deductible: 10000, coverage: ["意外", "医疗"] }),
      });

      const parsed = policyExtensionsRepo.parseData<{
        deductible: number;
        coverage: string[];
      }>(ext);

      expect(parsed.deductible).toBe(10000);
      expect(parsed.coverage).toEqual(["意外", "医疗"]);
    });

    test("deleteByPolicyId", () => {
      policyExtensionsRepo.create({
        policyId: testPolicyId,
        data: "{}",
      });

      expect(policyExtensionsRepo.deleteByPolicyId(testPolicyId)).toBe(true);
      expect(policyExtensionsRepo.deleteByPolicyId(testPolicyId)).toBe(false);
    });
  });

  describe("settingsRepo", () => {
    test("get/set string", () => {
      const s = settingsRepo.set("annual_income", "500000");
      expect(s.value).toBe("500000");

      expect(settingsRepo.get("annual_income")).toBe("500000");
      expect(settingsRepo.get("nonexistent")).toBeUndefined();

      settingsRepo.set("annual_income", "600000");
      expect(settingsRepo.get("annual_income")).toBe("600000");
    });

    test("findAll", () => {
      settingsRepo.set("key1", "value1");
      settingsRepo.set("key2", "value2");

      expect(settingsRepo.findAll()).toHaveLength(2);
    });

    test("delete", () => {
      settingsRepo.set("key1", "value1");

      expect(settingsRepo.delete("key1")).toBe(true);
      expect(settingsRepo.delete("key1")).toBe(false);
      expect(settingsRepo.get("key1")).toBeUndefined();
    });

    test("getNumber/setNumber", () => {
      settingsRepo.setNumber("income", 500000);
      expect(settingsRepo.getNumber("income")).toBe(500000);

      expect(settingsRepo.getNumber("nonexistent")).toBeUndefined();

      settingsRepo.set("invalid", "not-a-number");
      expect(settingsRepo.getNumber("invalid")).toBeUndefined();
    });

    test("getJson/setJson", () => {
      const data = { premium_ratio: 0.1, categories: ["Life", "Medical"] };
      settingsRepo.setJson("config", data);

      const retrieved = settingsRepo.getJson<typeof data>("config");
      expect(retrieved?.premium_ratio).toBe(0.1);
      expect(retrieved?.categories).toEqual(["Life", "Medical"]);

      expect(settingsRepo.getJson("nonexistent")).toBeUndefined();

      settingsRepo.set("invalid_json", "not-valid-json");
      expect(settingsRepo.getJson("invalid_json")).toBeUndefined();
    });
  });
});
