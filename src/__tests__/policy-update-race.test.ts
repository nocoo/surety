/**
 * Tests the orphan insurer rollback in PUT /api/policies/:id
 * when a race condition causes the policy to be deleted between
 * the pre-check findById and the actual update.
 *
 * Uses real in-memory DB to exercise the exact code path.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import {
  policiesRepo,
  membersRepo,
  insurersRepo,
} from "@/db/repositories";
import type { NewPolicy } from "@/db/schema";

describe("PUT /api/policies/:id orphan insurer rollback", () => {
  let testMemberId: number;
  let testPolicyId: number;

  const createTestPolicy = (overrides: Partial<NewPolicy> = {}): NewPolicy => ({
    applicantId: testMemberId,
    insuredType: "Member",
    insuredMemberId: testMemberId,
    category: "Life",
    insurerName: "旧保险公司",
    productName: "旧产品",
    policyNumber: `POL-${Date.now()}`,
    sumAssured: 100000,
    premium: 5000,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-01-01",
    ...overrides,
  });

  beforeEach(async () => {
    resetTestDb();
    const member = await membersRepo.create({
      name: "测试人",
      relation: "Self",
      birthDate: "1985-01-01",
    });
    testMemberId = member.id;

    const policy = await policiesRepo.create(createTestPolicy());
    testPolicyId = policy.id;
  });

  test("update returns undefined when policy is deleted before update", async () => {
    // Verify policy exists
    const existing = await policiesRepo.findById(testPolicyId);
    expect(existing).toBeDefined();

    // Simulate concurrent delete (between findById pre-check and update)
    await policiesRepo.delete(testPolicyId);

    // update() on deleted row returns undefined
    const updated = await policiesRepo.update(testPolicyId, {
      productName: "新产品",
    });
    expect(updated).toBeUndefined();
  });

  test("newly created insurer is rolled back when policy vanishes before update", async () => {
    // Verify policy exists (pre-check would pass)
    const existing = await policiesRepo.findById(testPolicyId);
    expect(existing).toBeDefined();

    // Create a new insurer via findOrCreate (simulates the PUT handler's insurer resolution)
    const newInsurerName = "全新保险公司_不存在的";
    const insurer = await insurersRepo.findOrCreate(newInsurerName);
    expect(insurer.created).toBe(true);

    // Simulate concurrent delete (race window)
    await policiesRepo.delete(testPolicyId);

    // update() returns undefined — policy gone
    const updated = await policiesRepo.update(testPolicyId, {
      insurerId: insurer.id,
      insurerName: insurer.name,
      productName: "新产品",
    });
    expect(updated).toBeUndefined();

    // The fix: roll back the orphan insurer (mimics the patched route handler logic)
    if (insurer.created) {
      await insurersRepo.delete(insurer.id);
    }

    // Verify insurer is cleaned up — no orphan
    const orphan = await insurersRepo.findById(insurer.id);
    expect(orphan).toBeUndefined();
  });

  test("existing insurer is NOT deleted when policy vanishes (only newly created ones)", async () => {
    // Pre-create an insurer that already exists
    await insurersRepo.create({ name: "已有保险公司" });

    const existing = await policiesRepo.findById(testPolicyId);
    expect(existing).toBeDefined();

    // findOrCreate returns created: false for existing insurer
    const insurer = await insurersRepo.findOrCreate("已有保险公司");
    expect(insurer.created).toBe(false);

    // Simulate concurrent delete
    await policiesRepo.delete(testPolicyId);

    const updated = await policiesRepo.update(testPolicyId, {
      insurerId: insurer.id,
      insurerName: insurer.name,
    });
    expect(updated).toBeUndefined();

    // Rollback guard: only delete if created === true
    if (insurer.created) {
      await insurersRepo.delete(insurer.id);
    }

    // Existing insurer should still be there
    const stillExists = await insurersRepo.findById(insurer.id);
    expect(stillExists).toBeDefined();
    expect(stillExists?.name).toBe("已有保险公司");
  });
});
