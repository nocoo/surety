import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@surety/db";
import {
  beneficiariesRepo,
  paymentsRepo,
  cashValuesRepo,
  settingsRepo,
  membersRepo,
  policiesRepo,
} from "@surety/db/repositories";
import type { NewPolicy } from "@surety/db/schema";

describe("Other Repositories", () => {
  let testPolicyId: number;

  beforeEach(async () => {
    resetTestDb();

    const member = await membersRepo.create({
      name: "张三",
      relation: "Self",
      birthDate: "1985-01-01",
    });

    const policy = await policiesRepo.create({
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
    test("CRUD operations", async () => {
      const b = await beneficiariesRepo.create({
        policyId: testPolicyId,
        externalName: "张小明",
        sharePercent: 100,
        rankOrder: 1,
      });
      expect(b.id).toBe(1);

      expect(await beneficiariesRepo.findAll()).toHaveLength(1);

      expect((await beneficiariesRepo.findById(b.id))?.externalName).toBe("张小明");
      expect(await beneficiariesRepo.findById(999)).toBeUndefined();

      expect(await beneficiariesRepo.findByPolicyId(testPolicyId)).toHaveLength(1);

      const updated = await beneficiariesRepo.update(b.id, { sharePercent: 50 });
      expect(updated?.sharePercent).toBe(50);
      expect(await beneficiariesRepo.update(999, { sharePercent: 50 })).toBeUndefined();

      expect(await beneficiariesRepo.delete(b.id)).toBe(true);
      expect(await beneficiariesRepo.delete(999)).toBe(false);
    });

    test("deleteByPolicyId", async () => {
      await beneficiariesRepo.create({
        policyId: testPolicyId,
        externalName: "B1",
        sharePercent: 50,
        rankOrder: 1,
      });
      await beneficiariesRepo.create({
        policyId: testPolicyId,
        externalName: "B2",
        sharePercent: 50,
        rankOrder: 2,
      });

      expect(await beneficiariesRepo.deleteByPolicyId(testPolicyId)).toBe(2);
      expect(await beneficiariesRepo.findByPolicyId(testPolicyId)).toHaveLength(0);
    });

    test("findByMemberId returns beneficiaries linked to a member", async () => {
      const beneficiaryMember = await membersRepo.create({
        name: "王五",
        relation: "Child",
        birthDate: "2015-06-01",
      });

      await beneficiariesRepo.create({
        policyId: testPolicyId,
        memberId: beneficiaryMember.id,
        sharePercent: 60,
        rankOrder: 1,
      });
      await beneficiariesRepo.create({
        policyId: testPolicyId,
        externalName: "外部受益人",
        sharePercent: 40,
        rankOrder: 2,
      });

      const linked = await beneficiariesRepo.findByMemberId(beneficiaryMember.id);
      expect(linked).toHaveLength(1);
      expect(linked[0]?.memberId).toBe(beneficiaryMember.id);
      expect(linked[0]?.sharePercent).toBe(60);

      expect(await beneficiariesRepo.findByMemberId(9999)).toEqual([]);
    });
  });

  describe("paymentsRepo", () => {
    test("CRUD operations", async () => {
      const p = await paymentsRepo.create({
        policyId: testPolicyId,
        periodNumber: 1,
        dueDate: "2024-01-01",
        amount: 10000,
      });
      expect(p.id).toBe(1);
      expect(p.status).toBe("Pending");

      expect(await paymentsRepo.findAll()).toHaveLength(1);

      expect((await paymentsRepo.findById(p.id))?.amount).toBe(10000);
      expect(await paymentsRepo.findById(999)).toBeUndefined();

      expect(await paymentsRepo.findByPolicyId(testPolicyId)).toHaveLength(1);

      expect(await paymentsRepo.findByStatus("Pending")).toHaveLength(1);

      const updated = await paymentsRepo.update(p.id, {
        status: "Paid",
        paidDate: "2024-01-05",
        paidAmount: 10000,
      });
      expect(updated?.status).toBe("Paid");
      expect(await paymentsRepo.update(999, { status: "Paid" })).toBeUndefined();

      expect(await paymentsRepo.delete(p.id)).toBe(true);
      expect(await paymentsRepo.delete(999)).toBe(false);
    });

    test("createMany", async () => {
      const payments = await paymentsRepo.createMany([
        { policyId: testPolicyId, periodNumber: 1, dueDate: "2024-01-01", amount: 10000 },
        { policyId: testPolicyId, periodNumber: 2, dueDate: "2025-01-01", amount: 10000 },
      ]);
      expect(payments).toHaveLength(2);
    });

    test("deleteByPolicyId", async () => {
      await paymentsRepo.createMany([
        { policyId: testPolicyId, periodNumber: 1, dueDate: "2024-01-01", amount: 10000 },
        { policyId: testPolicyId, periodNumber: 2, dueDate: "2025-01-01", amount: 10000 },
      ]);

      expect(await paymentsRepo.deleteByPolicyId(testPolicyId)).toBe(2);
    });
  });

  describe("cashValuesRepo", () => {
    test("CRUD operations", async () => {
      const cv = await cashValuesRepo.create({
        policyId: testPolicyId,
        policyYear: 1,
        value: 5000,
      });
      expect(cv.id).toBe(1);

      expect(await cashValuesRepo.findAll()).toHaveLength(1);

      expect((await cashValuesRepo.findById(cv.id))?.value).toBe(5000);
      expect(await cashValuesRepo.findById(999)).toBeUndefined();

      expect(await cashValuesRepo.findByPolicyId(testPolicyId)).toHaveLength(1);

      const updated = await cashValuesRepo.update(cv.id, { value: 6000 });
      expect(updated?.value).toBe(6000);
      expect(await cashValuesRepo.update(999, { value: 100 })).toBeUndefined();

      expect(await cashValuesRepo.delete(cv.id)).toBe(true);
      expect(await cashValuesRepo.delete(999)).toBe(false);
    });

    test("createMany", async () => {
      const cvs = await cashValuesRepo.createMany([
        { policyId: testPolicyId, policyYear: 1, value: 5000 },
        { policyId: testPolicyId, policyYear: 2, value: 10000 },
      ]);
      expect(cvs).toHaveLength(2);
    });

    test("deleteByPolicyId", async () => {
      await cashValuesRepo.createMany([
        { policyId: testPolicyId, policyYear: 1, value: 5000 },
        { policyId: testPolicyId, policyYear: 2, value: 10000 },
      ]);

      expect(await cashValuesRepo.deleteByPolicyId(testPolicyId)).toBe(2);
    });
  });

  describe("settingsRepo", () => {
    test("get/set string", async () => {
      const s = await settingsRepo.set("annual_income", "500000");
      expect(s.value).toBe("500000");

      expect(await settingsRepo.get("annual_income")).toBe("500000");
      expect(await settingsRepo.get("nonexistent")).toBeUndefined();

      await settingsRepo.set("annual_income", "600000");
      expect(await settingsRepo.get("annual_income")).toBe("600000");
    });

    test("findAll", async () => {
      await settingsRepo.set("key1", "value1");
      await settingsRepo.set("key2", "value2");

      expect(await settingsRepo.findAll()).toHaveLength(2);
    });

    test("delete", async () => {
      await settingsRepo.set("key1", "value1");

      expect(await settingsRepo.delete("key1")).toBe(true);
      expect(await settingsRepo.delete("key1")).toBe(false);
      expect(await settingsRepo.get("key1")).toBeUndefined();
    });

    test("getNumber/setNumber", async () => {
      await settingsRepo.setNumber("income", 500000);
      expect(await settingsRepo.getNumber("income")).toBe(500000);

      expect(await settingsRepo.getNumber("nonexistent")).toBeUndefined();

      await settingsRepo.set("invalid", "not-a-number");
      expect(await settingsRepo.getNumber("invalid")).toBeUndefined();
    });

    test("getJson/setJson", async () => {
      const data = { premium_ratio: 0.1, categories: ["Life", "Medical"] };
      await settingsRepo.setJson("config", data);

      const retrieved = await settingsRepo.getJson<typeof data>("config");
      expect(retrieved?.premium_ratio).toBe(0.1);
      expect(retrieved?.categories).toEqual(["Life", "Medical"]);

      expect(await settingsRepo.getJson("nonexistent")).toBeUndefined();

      await settingsRepo.set("invalid_json", "not-valid-json");
      expect(await settingsRepo.getJson("invalid_json")).toBeUndefined();
    });
  });
});
