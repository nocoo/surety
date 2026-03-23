/**
 * Unit Tests: MCP Tools - Coverage Items
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import {
  coverageItemsRepo,
  membersRepo,
  policiesRepo,
  insurersRepo,
  settingsRepo,
} from "@/db/repositories";
import { registerCoverageItemTools } from "../tools/coverage-items";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerCoverageItemTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

/** Create a member + insurer + policy for coverage item tests */
async function seedPolicy() {
  const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
  const insurer = await insurersRepo.create({ name: "China Life" });
  const policy = await policiesRepo.create({
    applicantId: member.id,
    insuredType: "Member",
    insuredMemberId: member.id,
    category: "Medical",
    insurerName: "China Life",
    insurerId: insurer.id,
    productName: "Medical Insurance",
    policyNumber: "POL-001",
    sumAssured: 2000000,
    premium: 800,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-01-01",
    status: "Active",
  });
  return { member, insurer, policy };
}

describe("list-coverage-items", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-coverage-items")({ policyId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-coverage-items")({ policyId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return empty array when policy has no coverage items", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "list-coverage-items")({ policyId: policy.id });
    expect(parseResult(result)).toEqual([]);
  });

  test("should return all coverage items for a policy", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    await coverageItemsRepo.create({
      policyId: policy.id,
      name: "General Medical",
      periodLimit: 2000000,
      deductible: 10000,
      coveragePercent: 100,
      sortOrder: 1,
    });
    await coverageItemsRepo.create({
      policyId: policy.id,
      name: "Critical Illness",
      lifetimeLimit: 4000000,
      deductible: 0,
      coveragePercent: 100,
      isOptional: false,
      sortOrder: 2,
    });

    const result = await getHandler(tools, "list-coverage-items")({ policyId: policy.id });
    const data = parseResult(result);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("General Medical");
    expect(data[0].periodLimit).toBe(2000000);
    expect(data[0].deductible).toBe(10000);
    expect(data[1].name).toBe("Critical Illness");
    expect(data[1].lifetimeLimit).toBe(4000000);
  });
});

describe("create-coverage-item", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-coverage-item")({
      policyId: 1,
      name: "Test",
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "create-coverage-item")({
      policyId: 999,
      name: "Test",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Policy with id 999 not found");
  });

  test("should create a coverage item with required fields", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-coverage-item")({
      policyId: policy.id,
      name: "General Medical",
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.policyId).toBe(policy.id);
    expect(data.name).toBe("General Medical");
    expect(data.sortOrder).toBe(0); // default
  });

  test("should create a coverage item with all optional fields", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-coverage-item")({
      policyId: policy.id,
      name: "Critical Illness",
      periodLimit: 2000000,
      lifetimeLimit: 4000000,
      deductible: 10000,
      coveragePercent: 100,
      isOptional: true,
      notes: "Optional rider",
      sortOrder: 2,
    });
    const data = parseResult(result);
    expect(data.name).toBe("Critical Illness");
    expect(data.periodLimit).toBe(2000000);
    expect(data.lifetimeLimit).toBe(4000000);
    expect(data.deductible).toBe(10000);
    expect(data.coveragePercent).toBe(100);
    expect(data.isOptional).toBe(true);
    expect(data.notes).toBe("Optional rider");
    expect(data.sortOrder).toBe(2);
  });
});

describe("update-coverage-item", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-coverage-item")({
      coverageItemId: 1,
      name: "Updated",
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent coverage item", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-coverage-item")({
      coverageItemId: 999,
      name: "Updated",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should update coverage item fields", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const ci = await coverageItemsRepo.create({
      policyId: policy.id,
      name: "General Medical",
      deductible: 10000,
      sortOrder: 1,
    });

    const result = await getHandler(tools, "update-coverage-item")({
      coverageItemId: ci.id,
      deductible: 5000,
      notes: "Reduced deductible",
    });
    const data = parseResult(result);
    expect(data.deductible).toBe(5000);
    expect(data.notes).toBe("Reduced deductible");
    expect(data.name).toBe("General Medical"); // unchanged
  });
});

describe("delete-coverage-item", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-coverage-item")({ coverageItemId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent coverage item", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-coverage-item")({ coverageItemId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should delete a coverage item", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const ci = await coverageItemsRepo.create({
      policyId: policy.id,
      name: "General Medical",
      sortOrder: 1,
    });

    const result = await getHandler(tools, "delete-coverage-item")({ coverageItemId: ci.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await coverageItemsRepo.findById(ci.id)).toBeUndefined();
  });
});
