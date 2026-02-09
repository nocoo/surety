/**
 * Unit Tests: MCP Tools - Assets
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import { membersRepo, assetsRepo, settingsRepo } from "@/db/repositories";
import { registerAssetTools } from "../tools/assets";
import { createMockServer, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerAssetTools(server);
  return tools;
}

function enableMcp() {
  settingsRepo.set("mcp.enabled", "true");
}

describe("list-assets", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await tools.get("list-assets")!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return empty array when no assets exist", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools.get("list-assets")!.handler({});
    const data = parseResult(result);
    expect(data).toEqual([]);
  });

  test("should return assets with owner names", async () => {
    const tools = setup();
    enableMcp();

    const owner = membersRepo.create({
      name: "Zhang San",
      relation: "Self",
      gender: "M",
    });

    assetsRepo.create({
      type: "Vehicle",
      name: "Tesla Model Y",
      identifier: "京A12345",
      ownerId: owner.id,
    });

    assetsRepo.create({
      type: "RealEstate",
      name: "Apartment in Pudong",
      identifier: "沪房证2024-00123",
      ownerId: owner.id,
      details: JSON.stringify({ area: 120, address: "Pudong New Area" }),
    });

    const result = await tools.get("list-assets")!.handler({});
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
    enableMcp();

    assetsRepo.create({
      type: "Vehicle",
      name: "Old Car",
      identifier: "京B99999",
    });

    const result = await tools.get("list-assets")!.handler({});
    const data = parseResult(result);

    expect(data).toHaveLength(1);
    expect(data[0].ownerName).toBeUndefined();
  });

  test("should handle assets without details", async () => {
    const tools = setup();
    enableMcp();

    assetsRepo.create({
      type: "Vehicle",
      name: "Car",
      identifier: "ABC",
    });

    const result = await tools.get("list-assets")!.handler({});
    const data = parseResult(result);

    expect(data[0].details).toBeUndefined();
  });

  test("should not expose sensitive timestamps", async () => {
    const tools = setup();
    enableMcp();

    assetsRepo.create({
      type: "Vehicle",
      name: "Car",
      identifier: "ABC",
    });

    const result = await tools.get("list-assets")!.handler({});
    const data = parseResult(result);

    expect(data[0]).not.toHaveProperty("createdAt");
    expect(data[0]).not.toHaveProperty("updatedAt");
  });
});
