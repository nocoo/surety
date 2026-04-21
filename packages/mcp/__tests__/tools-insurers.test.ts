/**
 * Unit Tests: MCP Tools - Insurers
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@surety/db";
import {
  insurersRepo,
  policiesRepo,
  membersRepo,
  settingsRepo,
} from "@surety/db/repositories";
import { registerInsurerTools } from "../src/tools/insurers";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerInsurerTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

describe("list-insurers", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-insurers")({});
    expect(result.isError).toBe(true);
  });

  test("should return empty array when no insurers exist", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-insurers")({});
    expect(parseResult(result)).toEqual([]);
  });

  test("should return all insurers", async () => {
    const tools = setup();
    await enableMcp();
    await insurersRepo.create({ name: "China Life", phone: "95519" });
    await insurersRepo.create({ name: "Ping An", website: "https://pingan.com" });

    const result = await getHandler(tools, "list-insurers")({});
    const data = parseResult(result);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("China Life");
    expect(data[1].name).toBe("Ping An");
  });
});

describe("get-insurer", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-insurer")({ insurerId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent insurer", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-insurer")({ insurerId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return insurer details", async () => {
    const tools = setup();
    await enableMcp();
    const insurer = await insurersRepo.create({ name: "China Life", phone: "95519" });

    const result = await getHandler(tools, "get-insurer")({ insurerId: insurer.id });
    const data = parseResult(result);
    expect(data.name).toBe("China Life");
    expect(data.phone).toBe("95519");
  });
});

describe("create-insurer", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-insurer")({ name: "Test" });
    expect(result.isError).toBe(true);
  });

  test("should create an insurer", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "create-insurer")({
      name: "New Insurer",
      phone: "400-800-1234",
      website: "https://example.com",
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.name).toBe("New Insurer");
    expect(data.phone).toBe("400-800-1234");
  });
});

describe("update-insurer", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-insurer")({ insurerId: 1, name: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent insurer", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-insurer")({ insurerId: 999, name: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should update insurer fields", async () => {
    const tools = setup();
    await enableMcp();
    const insurer = await insurersRepo.create({ name: "Old Name" });

    const result = await getHandler(tools, "update-insurer")({
      insurerId: insurer.id,
      phone: "12345",
    });
    const data = parseResult(result);
    expect(data.phone).toBe("12345");
    expect(data.name).toBe("Old Name"); // unchanged
  });

  test("should sync insurerName to related policies when name changes", async () => {
    const tools = setup();
    await enableMcp();
    const insurer = await insurersRepo.create({ name: "Old Name" });
    const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });

    const policy = await policiesRepo.create({
      applicantId: member.id,
      insuredType: "Member",
      insuredMemberId: member.id,
      category: "Life",
      insurerName: "Old Name",
      insurerId: insurer.id,
      productName: "Term Life",
      policyNumber: "POL-001",
      sumAssured: 1000000,
      premium: 3000,
      paymentFrequency: "Yearly",
      effectiveDate: "2024-01-01",
      status: "Active",
    });

    await getHandler(tools, "update-insurer")({
      insurerId: insurer.id,
      name: "New Name",
    });

    // Verify policy insurerName was synced
    const updatedPolicy = await policiesRepo.findById(policy.id);
    expect(updatedPolicy?.insurerName).toBe("New Name");
  });
});

describe("delete-insurer", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-insurer")({ insurerId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent insurer", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-insurer")({ insurerId: 999 });
    expect(result.isError).toBe(true);
  });

  test("should delete an unreferenced insurer", async () => {
    const tools = setup();
    await enableMcp();
    const insurer = await insurersRepo.create({ name: "Delete Me" });

    const result = await getHandler(tools, "delete-insurer")({ insurerId: insurer.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await insurersRepo.findById(insurer.id)).toBeUndefined();
  });

  test("should refuse to delete insurer referenced by policies", async () => {
    const tools = setup();
    await enableMcp();
    const insurer = await insurersRepo.create({ name: "Referenced" });
    const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });

    await policiesRepo.create({
      applicantId: member.id,
      insuredType: "Member",
      insuredMemberId: member.id,
      category: "Life",
      insurerName: "Referenced",
      insurerId: insurer.id,
      productName: "Test",
      policyNumber: "POL-001",
      sumAssured: 1000000,
      premium: 3000,
      paymentFrequency: "Yearly",
      effectiveDate: "2024-01-01",
      status: "Active",
    });

    const result = await getHandler(tools, "delete-insurer")({ insurerId: insurer.id });
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("still referenced");
    expect(data.policies).toHaveLength(1);
  });
});
