import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest, SEED_COUNTS } from "./setup";

interface Asset {
  id: number;
  type: "RealEstate" | "Vehicle";
  name: string;
  identifier: string;
  ownerId: number | null;
  ownerName: string | null;
  details: string | null;
}

interface Member {
  id: number;
  name: string;
  relation: string;
}

describe("Assets API E2E", () => {
  let testOwnerId: number;

  beforeAll(async () => {
    await setupE2E();

    // Get a member to use as owner
    const { data: members } = await apiRequest<Member[]>("/api/members");
    if (members.length > 0) {
      testOwnerId = members[0]!.id;
    }
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("Seed data verification", () => {
    test("GET /api/assets returns seeded assets", async () => {
      const { status, data } = await apiRequest<Asset[]>("/api/assets");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(SEED_COUNTS.assets);
    });

    test("seeded assets have correct structure", async () => {
      const { data } = await apiRequest<Asset[]>("/api/assets");
      const asset = data[0]!;

      expect(typeof asset.id).toBe("number");
      expect(["RealEstate", "Vehicle"]).toContain(asset.type);
      expect(typeof asset.name).toBe("string");
      expect(typeof asset.identifier).toBe("string");
    });
  });

  describe("CRUD operations", () => {
    let createdAssetId: number;

    test("GET /api/assets returns list", async () => {
      const { status, data } = await apiRequest<Asset[]>("/api/assets");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/assets creates new RealEstate", async () => {
      const newAsset = {
        type: "RealEstate",
        name: "E2E测试房产",
        identifier: "京(2026)测试区不动产权第9999999号",
        ownerId: testOwnerId,
        details: JSON.stringify({ address: "测试地址", area: 100 }),
      };

      const { status, data } = await apiRequest<Asset>("/api/assets", {
        method: "POST",
        body: JSON.stringify(newAsset),
      });

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.name).toBe("E2E测试房产");
      expect(data.type).toBe("RealEstate");
      expect(data.identifier).toBe("京(2026)测试区不动产权第9999999号");
      createdAssetId = data.id;
    });

    test("POST /api/assets creates new Vehicle", async () => {
      const newAsset = {
        type: "Vehicle",
        name: "E2E测试车辆",
        identifier: "京Z99999",
        ownerId: testOwnerId,
        details: JSON.stringify({ brand: "TestBrand", model: "TestModel" }),
      };

      const { status, data } = await apiRequest<Asset>("/api/assets", {
        method: "POST",
        body: JSON.stringify(newAsset),
      });

      expect(status).toBe(201);
      expect(data.type).toBe("Vehicle");
      expect(data.identifier).toBe("京Z99999");

      // Cleanup
      await apiRequest<{ success: boolean }>(`/api/assets/${data.id}`, {
        method: "DELETE",
      });
    });

    test("GET /api/assets/:id returns single asset", async () => {
      const { status, data } = await apiRequest<Asset>(
        `/api/assets/${createdAssetId}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(createdAssetId);
      expect(data.name).toBe("E2E测试房产");
    });

    test("PUT /api/assets/:id updates asset", async () => {
      const { status, data } = await apiRequest<Asset>(
        `/api/assets/${createdAssetId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: "E2E更新房产",
            identifier: "京(2026)更新区不动产权第8888888号",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.name).toBe("E2E更新房产");
      expect(data.identifier).toBe("京(2026)更新区不动产权第8888888号");
    });

    test("DELETE /api/assets/:id deletes asset", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/assets/${createdAssetId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest<Asset>(
        `/api/assets/${createdAssetId}`
      );
      expect(getStatus).toBe(404);
    });
  });

  describe("Error handling", () => {
    test("POST /api/assets with missing fields returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/assets",
        {
          method: "POST",
          body: JSON.stringify({ name: "只有名字" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("POST /api/assets with missing type returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/assets",
        {
          method: "POST",
          body: JSON.stringify({
            name: "测试",
            identifier: "测试标识",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("POST /api/assets with invalid type returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/assets",
        {
          method: "POST",
          body: JSON.stringify({
            type: "InvalidType",
            name: "测试",
            identifier: "测试标识",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("RealEstate or Vehicle");
    });

    test("GET /api/assets/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/assets/invalid"
      );
      expect(status).toBe(400);
    });

    test("GET /api/assets/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/assets/99999"
      );
      expect(status).toBe(404);
    });

    test("PUT /api/assets/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/assets/abc",
        {
          method: "PUT",
          body: JSON.stringify({ name: "测试" }),
        }
      );
      expect(status).toBe(400);
    });

    test("PUT /api/assets/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/assets/99999",
        {
          method: "PUT",
          body: JSON.stringify({ name: "不存在" }),
        }
      );
      expect(status).toBe(404);
    });

    test("DELETE /api/assets/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/assets/xyz",
        { method: "DELETE" }
      );
      expect(status).toBe(400);
    });

    test("DELETE /api/assets/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/assets/99999",
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });

  describe("Edge cases", () => {
    let edgeCaseAssetId: number;

    test("POST /api/assets with optional fields as null", async () => {
      const { status, data } = await apiRequest<Asset>("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          type: "Vehicle",
          name: "可选字段测试车",
          identifier: "京X00000",
          ownerId: null,
          details: null,
        }),
      });

      expect(status).toBe(201);
      expect(data.name).toBe("可选字段测试车");
      expect(data.ownerId).toBeNull();
      expect(data.details).toBeNull();
      edgeCaseAssetId = data.id;
    });

    test("PUT /api/assets/:id with partial update", async () => {
      const { status, data } = await apiRequest<Asset>(
        `/api/assets/${edgeCaseAssetId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: "部分更新测试车",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.name).toBe("部分更新测试车");
      expect(data.identifier).toBe("京X00000"); // unchanged
    });

    test("cleanup: delete edge case asset", async () => {
      const { status } = await apiRequest<{ success: boolean }>(
        `/api/assets/${edgeCaseAssetId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
    });
  });
});
