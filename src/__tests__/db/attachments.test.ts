import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import { attachmentsRepo, membersRepo, policiesRepo } from "@/db/repositories";
import type { NewAttachment, NewPolicy } from "@/db/schema";

describe("attachmentsRepo", () => {
  let testPolicyId: number;

  const createTestAttachment = (
    overrides: Partial<NewAttachment> = {},
  ): NewAttachment => ({
    policyId: testPolicyId,
    filename: "test-policy.pdf",
    r2Key: `policies/${testPolicyId}/${crypto.randomUUID()}.pdf`,
    contentType: "application/pdf",
    size: 1024 * 100, // 100 KB
    ...overrides,
  });

  beforeEach(async () => {
    resetTestDb();

    // Create prerequisite member + policy
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
      effectiveDate: "2024-01-01",
    } satisfies NewPolicy);

    testPolicyId = policy.id;
  });

  describe("create", () => {
    test("creates an attachment", async () => {
      const attachment = await attachmentsRepo.create(createTestAttachment());

      expect(attachment.id).toBe(1);
      expect(attachment.policyId).toBe(testPolicyId);
      expect(attachment.filename).toBe("test-policy.pdf");
      expect(attachment.contentType).toBe("application/pdf");
      expect(attachment.size).toBe(102400);
      expect(attachment.createdAt).toBeInstanceOf(Date);
    });

    test("r2Key is unique", async () => {
      const r2Key = `policies/${testPolicyId}/same-key.pdf`;
      await attachmentsRepo.create(createTestAttachment({ r2Key }));

      await expect(
        attachmentsRepo.create(createTestAttachment({ r2Key })),
      ).rejects.toThrow();
    });
  });

  describe("findByPolicyId", () => {
    test("returns all attachments for a policy", async () => {
      await attachmentsRepo.create(
        createTestAttachment({ filename: "file1.pdf" }),
      );
      await attachmentsRepo.create(
        createTestAttachment({ filename: "file2.pdf" }),
      );

      const results = await attachmentsRepo.findByPolicyId(testPolicyId);
      expect(results).toHaveLength(2);
      expect(results.map((a) => a.filename)).toContain("file1.pdf");
      expect(results.map((a) => a.filename)).toContain("file2.pdf");
    });

    test("returns empty array for nonexistent policy", async () => {
      const results = await attachmentsRepo.findByPolicyId(9999);
      expect(results).toEqual([]);
    });
  });

  describe("findById", () => {
    test("returns attachment by ID", async () => {
      const created = await attachmentsRepo.create(createTestAttachment());
      const found = await attachmentsRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.filename).toBe("test-policy.pdf");
    });

    test("returns undefined for nonexistent ID", async () => {
      const found = await attachmentsRepo.findById(9999);
      expect(found).toBeUndefined();
    });
  });

  describe("findByIdAndPolicyId", () => {
    test("returns attachment when ID and policyId match", async () => {
      const created = await attachmentsRepo.create(createTestAttachment());
      const found = await attachmentsRepo.findByIdAndPolicyId(
        created.id,
        testPolicyId,
      );

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    test("returns undefined when policyId does not match (IDOR prevention)", async () => {
      const created = await attachmentsRepo.create(createTestAttachment());
      const found = await attachmentsRepo.findByIdAndPolicyId(
        created.id,
        9999,
      );

      expect(found).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes attachment and returns true", async () => {
      const created = await attachmentsRepo.create(createTestAttachment());
      const deleted = await attachmentsRepo.delete(created.id);

      expect(deleted).toBe(true);

      const found = await attachmentsRepo.findById(created.id);
      expect(found).toBeUndefined();
    });

    test("returns false for nonexistent ID", async () => {
      const deleted = await attachmentsRepo.delete(9999);
      expect(deleted).toBe(false);
    });
  });

  describe("deleteByPolicyId", () => {
    test("deletes all attachments for a policy and returns them", async () => {
      const a1 = await attachmentsRepo.create(
        createTestAttachment({ filename: "file1.pdf" }),
      );
      const a2 = await attachmentsRepo.create(
        createTestAttachment({ filename: "file2.pdf" }),
      );

      const deleted = await attachmentsRepo.deleteByPolicyId(testPolicyId);
      expect(deleted).toHaveLength(2);
      expect(deleted.map((a) => a.id).sort()).toEqual([a1.id, a2.id].sort());

      const remaining = await attachmentsRepo.findByPolicyId(testPolicyId);
      expect(remaining).toEqual([]);
    });

    test("returns empty array when no attachments exist", async () => {
      const deleted = await attachmentsRepo.deleteByPolicyId(testPolicyId);
      expect(deleted).toEqual([]);
    });
  });

  describe("countByPolicyId", () => {
    test("counts attachments for a policy", async () => {
      expect(await attachmentsRepo.countByPolicyId(testPolicyId)).toBe(0);

      await attachmentsRepo.create(createTestAttachment());
      expect(await attachmentsRepo.countByPolicyId(testPolicyId)).toBe(1);

      await attachmentsRepo.create(createTestAttachment());
      expect(await attachmentsRepo.countByPolicyId(testPolicyId)).toBe(2);
    });

    test("returns 0 for nonexistent policy", async () => {
      expect(await attachmentsRepo.countByPolicyId(9999)).toBe(0);
    });
  });

  describe("countGroupedByPolicyIds", () => {
    test("returns empty map when input is empty", async () => {
      const result = await attachmentsRepo.countGroupedByPolicyIds([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test("returns counts grouped by policy id", async () => {
      // Create a second policy so we can group across multiple policies.
      const member = await membersRepo.create({
        name: "李四",
        relation: "Spouse",
        birthDate: "1987-05-05",
      });
      const policy2 = await policiesRepo.create({
        applicantId: member.id,
        insuredType: "Member",
        insuredMemberId: member.id,
        category: "Life",
        insurerName: "平安人寿",
        productName: "平安福",
        policyNumber: `POL2-${Date.now()}`,
        sumAssured: 300000,
        premium: 8000,
        paymentFrequency: "Yearly",
        effectiveDate: "2024-02-01",
      } satisfies NewPolicy);

      await attachmentsRepo.create(
        createTestAttachment({ filename: "p1-a.pdf" }),
      );
      await attachmentsRepo.create(
        createTestAttachment({ filename: "p1-b.pdf" }),
      );
      await attachmentsRepo.create(
        createTestAttachment({
          policyId: policy2.id,
          filename: "p2-a.pdf",
          r2Key: `policies/${policy2.id}/${crypto.randomUUID()}.pdf`,
        }),
      );

      const result = await attachmentsRepo.countGroupedByPolicyIds([
        testPolicyId,
        policy2.id,
        9999, // nonexistent policy should not appear
      ]);

      expect(result.get(testPolicyId)).toBe(2);
      expect(result.get(policy2.id)).toBe(1);
      expect(result.has(9999)).toBe(false);
      expect(result.size).toBe(2);
    });

    test("omits policies with zero attachments", async () => {
      const result = await attachmentsRepo.countGroupedByPolicyIds([
        testPolicyId,
      ]);
      expect(result.size).toBe(0);
    });
  });
});
