import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import { membersRepo } from "@/db/repositories";

describe("membersRepo", () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe("create", () => {
    test("creates a member with required fields", () => {
      const member = membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-06-15",
      });

      expect(member.id).toBeGreaterThan(0);
      expect(member.name).toBe("张三");
      expect(member.relation).toBe("Self");
      expect(member.birthDate).toBe("1985-06-15");
      expect(member.createdAt).toBeInstanceOf(Date);
      expect(member.updatedAt).toBeInstanceOf(Date);
    });

    test("creates a member with all fields", () => {
      const member = membersRepo.create({
        name: "李四",
        relation: "Spouse",
        gender: "F",
        birthDate: "1988-03-20",
        idCard: "110101198803201234",
        idType: "身份证",
        idExpiry: "2021-10-05|2041-10-05",
        phone: "13800138000",
        hasSocialInsurance: true,
      });

      expect(member.name).toBe("李四");
      expect(member.gender).toBe("F");
      expect(member.idCard).toBe("110101198803201234");
      expect(member.idType).toBe("身份证");
      expect(member.idExpiry).toBe("2021-10-05|2041-10-05");
      expect(member.phone).toBe("13800138000");
      expect(member.hasSocialInsurance).toBe(true);
    });

    test("creates a member with id type 户口本", () => {
      const member = membersRepo.create({
        name: "王小明",
        relation: "Child",
        gender: "M",
        birthDate: "2025-02-25",
        idCard: "110114202502257530",
        idType: "户口本",
        idExpiry: "2025-03-11",
        hasSocialInsurance: false,
      });

      expect(member.idType).toBe("户口本");
      expect(member.hasSocialInsurance).toBe(false);
    });

    test("new fields default to null when omitted", () => {
      const member = membersRepo.create({
        name: "赵五",
        relation: "Parent",
      });

      expect(member.idType).toBeNull();
      expect(member.idExpiry).toBeNull();
      expect(member.hasSocialInsurance).toBeNull();
    });
  });

  describe("findAll", () => {
    test("returns empty array when no members", () => {
      const members = membersRepo.findAll();
      expect(members).toEqual([]);
    });

    test("returns all members", () => {
      membersRepo.create({ name: "张三", relation: "Self", birthDate: "1985-01-01" });
      membersRepo.create({ name: "李四", relation: "Spouse", birthDate: "1988-01-01" });

      const members = membersRepo.findAll();
      expect(members).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns member when found", () => {
      const created = membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-01-01",
      });

      const found = membersRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("张三");
    });

    test("returns undefined when not found", () => {
      const found = membersRepo.findById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("update", () => {
    test("updates member fields", () => {
      const member = membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-01-01",
      });

      const updated = membersRepo.update(member.id, {
        name: "张三丰",
        phone: "13900139000",
      });

      expect(updated?.name).toBe("张三丰");
      expect(updated?.phone).toBe("13900139000");
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        member.updatedAt.getTime()
      );
    });

    test("returns undefined when member not found", () => {
      const updated = membersRepo.update(999, { name: "不存在" });
      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes member and returns true", () => {
      const member = membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-01-01",
      });

      const result = membersRepo.delete(member.id);
      expect(result).toBe(true);

      const found = membersRepo.findById(member.id);
      expect(found).toBeUndefined();
    });

    test("returns false when member not found", () => {
      const result = membersRepo.delete(999);
      expect(result).toBe(false);
    });
  });
});
