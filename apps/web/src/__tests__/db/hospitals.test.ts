import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@surety/db";
import { hospitalsRepo } from "@surety/db/repositories";

describe("hospitalsRepo", () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe("create", () => {
    test("creates a hospital with required fields", async () => {
      const hospital = await hospitalsRepo.create({
        name: "北京协和医院",
      });

      expect(hospital.id).toBeGreaterThan(0);
      expect(hospital.name).toBe("北京协和医院");
      expect(hospital.level).toBeNull();
      expect(hospital.isPublic).toBe(true); // default
      expect(hospital.address).toBeNull();
      expect(hospital.phone).toBeNull();
      expect(hospital.notes).toBeNull();
      expect(hospital.createdAt).toBeInstanceOf(Date);
      expect(hospital.updatedAt).toBeInstanceOf(Date);
    });

    test("creates a hospital with all fields", async () => {
      const hospital = await hospitalsRepo.create({
        name: "北京和睦家医院",
        level: "三甲",
        isPublic: false,
        address: "北京市朝阳区将台路2号",
        phone: "010-59277000",
        notes: "私立医院",
      });

      expect(hospital.name).toBe("北京和睦家医院");
      expect(hospital.level).toBe("三甲");
      expect(hospital.isPublic).toBe(false);
      expect(hospital.address).toBe("北京市朝阳区将台路2号");
      expect(hospital.phone).toBe("010-59277000");
      expect(hospital.notes).toBe("私立医院");
    });

    test("allows duplicate hospital names", async () => {
      await hospitalsRepo.create({ name: "社区医院" });
      const second = await hospitalsRepo.create({
        name: "社区医院",
        address: "不同地址",
      });

      expect(second.id).toBeGreaterThan(0);
      expect(second.address).toBe("不同地址");
    });
  });

  describe("findAll", () => {
    test("returns empty array when no hospitals", async () => {
      const hospitals = await hospitalsRepo.findAll();
      expect(hospitals).toEqual([]);
    });

    test("returns all hospitals", async () => {
      await hospitalsRepo.create({ name: "北京协和医院" });
      await hospitalsRepo.create({ name: "北京儿童医院" });

      const hospitals = await hospitalsRepo.findAll();
      expect(hospitals).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns hospital when found", async () => {
      const created = await hospitalsRepo.create({ name: "北京协和医院" });

      const found = await hospitalsRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("北京协和医院");
    });

    test("returns undefined when not found", async () => {
      const found = await hospitalsRepo.findById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("findByName", () => {
    test("returns hospitals when found (array since names not unique)", async () => {
      await hospitalsRepo.create({ name: "社区医院", address: "地址1" });
      await hospitalsRepo.create({ name: "社区医院", address: "地址2" });

      const found = await hospitalsRepo.findByName("社区医院");
      expect(found).toHaveLength(2);
    });

    test("returns empty array when not found", async () => {
      const found = await hospitalsRepo.findByName("不存在的医院");
      expect(found).toEqual([]);
    });
  });

  describe("update", () => {
    test("updates hospital fields", async () => {
      const hospital = await hospitalsRepo.create({ name: "北京协和医院" });

      const updated = await hospitalsRepo.update(hospital.id, {
        level: "三甲",
        phone: "010-69156114",
      });

      expect(updated?.level).toBe("三甲");
      expect(updated?.phone).toBe("010-69156114");
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        hospital.updatedAt.getTime()
      );
    });

    test("returns undefined when hospital not found", async () => {
      const updated = await hospitalsRepo.update(999, { level: "三甲" });
      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes hospital and returns true", async () => {
      const hospital = await hospitalsRepo.create({ name: "北京协和医院" });

      const result = await hospitalsRepo.delete(hospital.id);
      expect(result).toBe(true);

      const found = await hospitalsRepo.findById(hospital.id);
      expect(found).toBeUndefined();
    });

    test("returns false when hospital not found", async () => {
      const result = await hospitalsRepo.delete(999);
      expect(result).toBe(false);
    });
  });
});
