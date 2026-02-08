import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import { insurersRepo } from "@/db/repositories";

describe("insurersRepo", () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe("create", () => {
    test("creates an insurer with required fields", () => {
      const insurer = insurersRepo.create({
        name: "中国人寿",
      });

      expect(insurer.id).toBeGreaterThan(0);
      expect(insurer.name).toBe("中国人寿");
      expect(insurer.phone).toBeNull();
      expect(insurer.website).toBeNull();
      expect(insurer.createdAt).toBeInstanceOf(Date);
      expect(insurer.updatedAt).toBeInstanceOf(Date);
    });

    test("creates an insurer with all fields", () => {
      const insurer = insurersRepo.create({
        name: "平安保险",
        phone: "95511",
        website: "https://www.pingan.com",
      });

      expect(insurer.name).toBe("平安保险");
      expect(insurer.phone).toBe("95511");
      expect(insurer.website).toBe("https://www.pingan.com");
    });
  });

  describe("findAll", () => {
    test("returns empty array when no insurers", () => {
      const insurers = insurersRepo.findAll();
      expect(insurers).toEqual([]);
    });

    test("returns all insurers", () => {
      insurersRepo.create({ name: "中国人寿" });
      insurersRepo.create({ name: "平安保险" });

      const insurers = insurersRepo.findAll();
      expect(insurers).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns insurer when found", () => {
      const created = insurersRepo.create({ name: "中国人寿" });

      const found = insurersRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("中国人寿");
    });

    test("returns undefined when not found", () => {
      const found = insurersRepo.findById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("findByName", () => {
    test("returns insurer when found", () => {
      insurersRepo.create({ name: "中国人寿", phone: "95519" });

      const found = insurersRepo.findByName("中国人寿");
      expect(found).toBeDefined();
      expect(found?.phone).toBe("95519");
    });

    test("returns undefined when not found", () => {
      const found = insurersRepo.findByName("不存在的保险公司");
      expect(found).toBeUndefined();
    });
  });

  describe("findOrCreate", () => {
    test("creates new insurer when not exists", () => {
      const insurer = insurersRepo.findOrCreate("新保险公司");

      expect(insurer.id).toBeGreaterThan(0);
      expect(insurer.name).toBe("新保险公司");
    });

    test("returns existing insurer when already exists", () => {
      const created = insurersRepo.create({ name: "中国人寿", phone: "95519" });
      const found = insurersRepo.findOrCreate("中国人寿");

      expect(found.id).toBe(created.id);
      expect(found.phone).toBe("95519");
    });
  });

  describe("update", () => {
    test("updates insurer fields", () => {
      const insurer = insurersRepo.create({ name: "中国人寿" });

      const updated = insurersRepo.update(insurer.id, {
        phone: "95519",
        website: "https://www.chinalife.com.cn",
      });

      expect(updated?.phone).toBe("95519");
      expect(updated?.website).toBe("https://www.chinalife.com.cn");
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        insurer.updatedAt.getTime()
      );
    });

    test("returns undefined when insurer not found", () => {
      const updated = insurersRepo.update(999, { phone: "12345" });
      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes insurer and returns true", () => {
      const insurer = insurersRepo.create({ name: "中国人寿" });

      const result = insurersRepo.delete(insurer.id);
      expect(result).toBe(true);

      const found = insurersRepo.findById(insurer.id);
      expect(found).toBeUndefined();
    });

    test("returns false when insurer not found", () => {
      const result = insurersRepo.delete(999);
      expect(result).toBe(false);
    });
  });
});
