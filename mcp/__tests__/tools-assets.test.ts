/**
 * Unit Tests: MCP Tools - Assets
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@surety/db";
import { membersRepo, assetsRepo, policiesRepo, settingsRepo } from "@surety/db/repositories";
import { registerAssetTools } from "../tools/assets";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerAssetTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

describe("list-assets", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-assets")({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return empty array when no assets exist", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-assets")({});
    const data = parseResult(result);
    expect(data).toEqual([]);
  });

  test("should return assets with owner names", async () => {
    const tools = setup();
    await enableMcp();

    const owner = await membersRepo.create({
      name: "Zhang San",
      relation: "Self",
      gender: "M",
    });

    await assetsRepo.create({
      type: "Vehicle",
      name: "Tesla Model Y",
      identifier: "京A12345",
      ownerId: owner.id,
    });

    await assetsRepo.create({
      type: "RealEstate",
      name: "Apartment in Pudong",
      identifier: "沪房证2024-00123",
      ownerId: owner.id,
      details: JSON.stringify({ area: 120, address: "Pudong New Area" }),
    });

    const result = await getHandler(tools, "list-assets")({});
    const data = parseResult(result);

    expect(data).toHaveLength(2);

    const car = data.find((a: Record<string, unknown>) => a.type === "Vehicle");
    expect(car.name).toBe("Tesla Model Y");
    expect(car.identifier).toBe("京A12345");
    expect(car.ownerName).toBe("Zhang San");

    const house = data.find((a: Record<string, unknown>) => a.type === "RealEstate");
    expect(house.name).toBe("Apartment in Pudong");
    expect(house.details).toEqual({ area: 120, address: "Pudong New Area" });
  });

  test("should handle assets without owner", async () => {
    const tools = setup();
    await enableMcp();

    await assetsRepo.create({
      type: "Vehicle",
      name: "Old Car",
      identifier: "京B99999",
    });

    const result = await getHandler(tools, "list-assets")({});
    const data = parseResult(result);

    expect(data).toHaveLength(1);
    expect(data[0].ownerName).toBeUndefined();
  });

  test("should handle assets without details", async () => {
    const tools = setup();
    await enableMcp();

    await assetsRepo.create({
      type: "Vehicle",
      name: "Car",
      identifier: "ABC",
    });

    const result = await getHandler(tools, "list-assets")({});
    const data = parseResult(result);

    expect(data[0].details).toBeUndefined();
  });

  test("should not expose sensitive timestamps", async () => {
    const tools = setup();
    await enableMcp();

    await assetsRepo.create({
      type: "Vehicle",
      name: "Car",
      identifier: "ABC",
    });

    const result = await getHandler(tools, "list-assets")({});
    const data = parseResult(result);

    expect(data[0]).not.toHaveProperty("createdAt");
    expect(data[0]).not.toHaveProperty("updatedAt");
  });
});

describe("get-asset", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-asset")({ assetId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent asset", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-asset")({ assetId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return asset details with owner name", async () => {
    const tools = setup();
    await enableMcp();
    const owner = await membersRepo.create({ name: "Zhang San", relation: "Self" });
    const asset = await assetsRepo.create({
      type: "Vehicle",
      name: "Tesla Model 3",
      identifier: "沪A12345",
      ownerId: owner.id,
    });

    const result = await getHandler(tools, "get-asset")({ assetId: asset.id });
    const data = parseResult(result);
    expect(data.name).toBe("Tesla Model 3");
    expect(data.ownerName).toBe("Zhang San");
  });
});

describe("create-asset", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-asset")({
      type: "Vehicle",
      name: "Car",
      identifier: "ABC",
    });
    expect(result.isError).toBe(true);
  });

  test("should create an asset with required fields", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "create-asset")({
      type: "Vehicle",
      name: "BMW X5",
      identifier: "京B88888",
    });
    const data = parseResult(result);

    expect(data.id).toBeDefined();
    expect(data.type).toBe("Vehicle");
    expect(data.name).toBe("BMW X5");
    expect(data.identifier).toBe("京B88888");
  });

  test("should create an asset with owner", async () => {
    const tools = setup();
    await enableMcp();
    const owner = await membersRepo.create({ name: "Li Si", relation: "Spouse" });

    const result = await getHandler(tools, "create-asset")({
      type: "RealEstate",
      name: "House",
      identifier: "CERT-001",
      ownerId: owner.id,
    });
    const data = parseResult(result);
    expect(data.ownerId).toBe(owner.id);
  });
});

describe("update-asset", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-asset")({ assetId: 1, name: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent asset", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-asset")({ assetId: 999, name: "Updated" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should update asset fields", async () => {
    const tools = setup();
    await enableMcp();
    const asset = await assetsRepo.create({ type: "Vehicle", name: "Old Car", identifier: "ABC" });

    const result = await getHandler(tools, "update-asset")({
      assetId: asset.id,
      name: "New Car",
      identifier: "XYZ",
    });
    const data = parseResult(result);
    expect(data.name).toBe("New Car");
    expect(data.identifier).toBe("XYZ");
  });
});

describe("delete-asset", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-asset")({ assetId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent asset", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-asset")({ assetId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should delete an unreferenced asset", async () => {
    const tools = setup();
    await enableMcp();
    const asset = await assetsRepo.create({ type: "Vehicle", name: "Car", identifier: "ABC" });

    const result = await getHandler(tools, "delete-asset")({ assetId: asset.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);

    expect(await assetsRepo.findById(asset.id)).toBeUndefined();
  });

  test("should refuse to delete asset referenced by policies", async () => {
    const tools = setup();
    await enableMcp();
    const owner = await membersRepo.create({ name: "Zhang San", relation: "Self" });
    const asset = await assetsRepo.create({ type: "Vehicle", name: "Car", identifier: "ABC", ownerId: owner.id });

    await policiesRepo.create({
      applicantId: owner.id,
      insuredType: "Asset",
      insuredAssetId: asset.id,
      category: "Property",
      insurerName: "CPIC",
      productName: "Auto",
      policyNumber: "POL-001",
      sumAssured: 300000,
      premium: 5000,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-01-01",
      status: "Active",
    });

    const result = await getHandler(tools, "delete-asset")({ assetId: asset.id });
    expect(result.isError).toBe(true);

    const data = parseResult(result);
    expect(data.error).toContain("still referenced");
    expect(data.policies).toHaveLength(1);
  });
});
