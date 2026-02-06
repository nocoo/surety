import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import { assetsRepo, membersRepo } from "@/db/repositories";

describe("assetsRepo", () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe("create", () => {
    test("creates an asset with required fields", () => {
      const asset = assetsRepo.create({
        type: "RealEstate",
        name: "自住房",
        identifier: "京房权证字第123456号",
      });

      expect(asset.id).toBe(1);
      expect(asset.type).toBe("RealEstate");
      expect(asset.name).toBe("自住房");
      expect(asset.identifier).toBe("京房权证字第123456号");
    });

    test("creates an asset with owner", () => {
      const member = membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-01-01",
      });

      const asset = assetsRepo.create({
        type: "Vehicle",
        name: "家用车",
        identifier: "京A12345",
        ownerId: member.id,
        details: JSON.stringify({ brand: "Toyota", year: 2023 }),
      });

      expect(asset.ownerId).toBe(member.id);
      expect(asset.details).toBeDefined();
    });
  });

  describe("findAll", () => {
    test("returns empty array when no assets", () => {
      expect(assetsRepo.findAll()).toEqual([]);
    });

    test("returns all assets", () => {
      assetsRepo.create({ type: "RealEstate", name: "房1", identifier: "id1" });
      assetsRepo.create({ type: "Vehicle", name: "车1", identifier: "id2" });

      expect(assetsRepo.findAll()).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns asset when found", () => {
      const created = assetsRepo.create({
        type: "RealEstate",
        name: "自住房",
        identifier: "id1",
      });

      const found = assetsRepo.findById(created.id);
      expect(found?.name).toBe("自住房");
    });

    test("returns undefined when not found", () => {
      expect(assetsRepo.findById(999)).toBeUndefined();
    });
  });

  describe("findByOwnerId", () => {
    test("returns assets for owner", () => {
      const member = membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-01-01",
      });

      assetsRepo.create({
        type: "RealEstate",
        name: "房1",
        identifier: "id1",
        ownerId: member.id,
      });
      assetsRepo.create({
        type: "Vehicle",
        name: "车1",
        identifier: "id2",
        ownerId: member.id,
      });
      assetsRepo.create({ type: "Vehicle", name: "车2", identifier: "id3" });

      const assets = assetsRepo.findByOwnerId(member.id);
      expect(assets).toHaveLength(2);
    });
  });

  describe("update", () => {
    test("updates asset fields", () => {
      const asset = assetsRepo.create({
        type: "RealEstate",
        name: "旧名",
        identifier: "id1",
      });

      const updated = assetsRepo.update(asset.id, { name: "新名" });
      expect(updated?.name).toBe("新名");
    });

    test("returns undefined when not found", () => {
      expect(assetsRepo.update(999, { name: "test" })).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes asset", () => {
      const asset = assetsRepo.create({
        type: "RealEstate",
        name: "房",
        identifier: "id1",
      });

      expect(assetsRepo.delete(asset.id)).toBe(true);
      expect(assetsRepo.findById(asset.id)).toBeUndefined();
    });

    test("returns false when not found", () => {
      expect(assetsRepo.delete(999)).toBe(false);
    });
  });
});
