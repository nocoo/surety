import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@surety/db";
import { assetsRepo, membersRepo } from "@surety/db/repositories";

describe("assetsRepo", () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe("create", () => {
    test("creates an asset with required fields", async () => {
      const asset = await assetsRepo.create({
        type: "RealEstate",
        name: "自住房",
        identifier: "京房权证字第123456号",
      });

      expect(asset.id).toBe(1);
      expect(asset.type).toBe("RealEstate");
      expect(asset.name).toBe("自住房");
      expect(asset.identifier).toBe("京房权证字第123456号");
    });

    test("creates an asset with owner", async () => {
      const member = await membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-01-01",
      });

      const asset = await assetsRepo.create({
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
    test("returns empty array when no assets", async () => {
      expect(await assetsRepo.findAll()).toEqual([]);
    });

    test("returns all assets", async () => {
      await assetsRepo.create({ type: "RealEstate", name: "房1", identifier: "id1" });
      await assetsRepo.create({ type: "Vehicle", name: "车1", identifier: "id2" });

      expect(await assetsRepo.findAll()).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns asset when found", async () => {
      const created = await assetsRepo.create({
        type: "RealEstate",
        name: "自住房",
        identifier: "id1",
      });

      const found = await assetsRepo.findById(created.id);
      expect(found?.name).toBe("自住房");
    });

    test("returns undefined when not found", async () => {
      expect(await assetsRepo.findById(999)).toBeUndefined();
    });
  });

  describe("findByOwnerId", () => {
    test("returns assets for owner", async () => {
      const member = await membersRepo.create({
        name: "张三",
        relation: "Self",
        birthDate: "1985-01-01",
      });

      await assetsRepo.create({
        type: "RealEstate",
        name: "房1",
        identifier: "id1",
        ownerId: member.id,
      });
      await assetsRepo.create({
        type: "Vehicle",
        name: "车1",
        identifier: "id2",
        ownerId: member.id,
      });
      await assetsRepo.create({ type: "Vehicle", name: "车2", identifier: "id3" });

      const assets = await assetsRepo.findByOwnerId(member.id);
      expect(assets).toHaveLength(2);
    });
  });

  describe("update", () => {
    test("updates asset fields", async () => {
      const asset = await assetsRepo.create({
        type: "RealEstate",
        name: "旧名",
        identifier: "id1",
      });

      const updated = await assetsRepo.update(asset.id, { name: "新名" });
      expect(updated?.name).toBe("新名");
    });

    test("returns undefined when not found", async () => {
      expect(await assetsRepo.update(999, { name: "test" })).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes asset", async () => {
      const asset = await assetsRepo.create({
        type: "RealEstate",
        name: "房",
        identifier: "id1",
      });

      expect(await assetsRepo.delete(asset.id)).toBe(true);
      expect(await assetsRepo.findById(asset.id)).toBeUndefined();
    });

    test("returns false when not found", async () => {
      expect(await assetsRepo.delete(999)).toBe(false);
    });
  });
});
