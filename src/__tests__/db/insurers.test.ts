import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import { insurersRepo } from "@/db/repositories";

describe("insurersRepo", () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe("create", () => {
    test("creates an insurer with required fields", async () => {
      const insurer = await insurersRepo.create({
        name: "中国人寿",
      });

      expect(insurer.id).toBeGreaterThan(0);
      expect(insurer.name).toBe("中国人寿");
      expect(insurer.phone).toBeNull();
      expect(insurer.website).toBeNull();
      expect(insurer.createdAt).toBeInstanceOf(Date);
      expect(insurer.updatedAt).toBeInstanceOf(Date);
    });

    test("creates an insurer with all fields", async () => {
      const insurer = await insurersRepo.create({
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
    test("returns empty array when no insurers", async () => {
      const insurers = await insurersRepo.findAll();
      expect(insurers).toEqual([]);
    });

    test("returns all insurers", async () => {
      await insurersRepo.create({ name: "中国人寿" });
      await insurersRepo.create({ name: "平安保险" });

      const insurers = await insurersRepo.findAll();
      expect(insurers).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns insurer when found", async () => {
      const created = await insurersRepo.create({ name: "中国人寿" });

      const found = await insurersRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("中国人寿");
    });

    test("returns undefined when not found", async () => {
      const found = await insurersRepo.findById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("findByName", () => {
    test("returns insurer when found", async () => {
      await insurersRepo.create({ name: "中国人寿", phone: "95519" });

      const found = await insurersRepo.findByName("中国人寿");
      expect(found).toBeDefined();
      expect(found?.phone).toBe("95519");
    });

    test("returns undefined when not found", async () => {
      const found = await insurersRepo.findByName("不存在的保险公司");
      expect(found).toBeUndefined();
    });
  });

  describe("findOrCreate", () => {
    test("creates new insurer when not exists", async () => {
      const insurer = await insurersRepo.findOrCreate("新保险公司");

      expect(insurer.id).toBeGreaterThan(0);
      expect(insurer.name).toBe("新保险公司");
      expect(insurer.created).toBe(true);
    });

    test("returns existing insurer when already exists", async () => {
      const created = await insurersRepo.create({ name: "中国人寿", phone: "95519" });
      const found = await insurersRepo.findOrCreate("中国人寿");

      expect(found.id).toBe(created.id);
      expect(found.phone).toBe("95519");
      expect(found.created).toBe(false);
    });
  });

  describe("update", () => {
    test("updates insurer fields", async () => {
      const insurer = await insurersRepo.create({ name: "中国人寿" });

      const updated = await insurersRepo.update(insurer.id, {
        phone: "95519",
        website: "https://www.chinalife.com.cn",
      });

      expect(updated?.phone).toBe("95519");
      expect(updated?.website).toBe("https://www.chinalife.com.cn");
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        insurer.updatedAt.getTime()
      );
    });

    test("returns undefined when insurer not found", async () => {
      const updated = await insurersRepo.update(999, { phone: "12345" });
      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes insurer and returns true", async () => {
      const insurer = await insurersRepo.create({ name: "中国人寿" });

      const result = await insurersRepo.delete(insurer.id);
      expect(result).toBe(true);

      const found = await insurersRepo.findById(insurer.id);
      expect(found).toBeUndefined();
    });

    test("returns false when insurer not found", async () => {
      const result = await insurersRepo.delete(999);
      expect(result).toBe(false);
    });
  });
});
