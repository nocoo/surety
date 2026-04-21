/**
 * Unit Tests: MCP Tools - Cash Values
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@surety/db";
import {
  cashValuesRepo,
  membersRepo,
  policiesRepo,
  insurersRepo,
  settingsRepo,
} from "@surety/db/repositories";
import { registerCashValueTools } from "../tools/cash-values";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerCashValueTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

/** Create a member + insurer + policy for cash value tests */
async function seedPolicy() {
  const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
  const insurer = await insurersRepo.create({ name: "China Life" });
  const policy = await policiesRepo.create({
    applicantId: member.id,
    insuredType: "Member",
    insuredMemberId: member.id,
    category: "Life",
    insurerName: "China Life",
    insurerId: insurer.id,
    productName: "Whole Life",
    policyNumber: "POL-001",
    sumAssured: 500000,
    premium: 10000,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-01-01",
    status: "Active",
  });
  return { member, insurer, policy };
}

describe("list-cash-values", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-cash-values")({ policyId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-cash-values")({ policyId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return empty array when policy has no cash values", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "list-cash-values")({ policyId: policy.id });
    expect(parseResult(result)).toEqual([]);
  });

  test("should return all cash values for a policy", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    await cashValuesRepo.create({ policyId: policy.id, policyYear: 1, value: 5000 });
    await cashValuesRepo.create({ policyId: policy.id, policyYear: 2, value: 12000 });
    await cashValuesRepo.create({ policyId: policy.id, policyYear: 3, value: 20000 });

    const result = await getHandler(tools, "list-cash-values")({ policyId: policy.id });
    const data = parseResult(result);
    expect(data).toHaveLength(3);
    expect(data[0].policyYear).toBe(1);
    expect(data[0].value).toBe(5000);
    expect(data[2].policyYear).toBe(3);
    expect(data[2].value).toBe(20000);
  });
});

describe("create-cash-value", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-cash-value")({
      policyId: 1,
      policyYear: 1,
      value: 5000,
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "create-cash-value")({
      policyId: 999,
      policyYear: 1,
      value: 5000,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Policy with id 999 not found");
  });

  test("should create a cash value record", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-cash-value")({
      policyId: policy.id,
      policyYear: 1,
      value: 5000,
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.policyId).toBe(policy.id);
    expect(data.policyYear).toBe(1);
    expect(data.value).toBe(5000);
  });
});

describe("update-cash-value", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-cash-value")({
      cashValueId: 1,
      value: 6000,
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent cash value", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-cash-value")({
      cashValueId: 999,
      value: 6000,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should update cash value fields", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const cv = await cashValuesRepo.create({
      policyId: policy.id,
      policyYear: 1,
      value: 5000,
    });

    const result = await getHandler(tools, "update-cash-value")({
      cashValueId: cv.id,
      value: 5500,
    });
    const data = parseResult(result);
    expect(data.value).toBe(5500);
    expect(data.policyYear).toBe(1); // unchanged
  });
});

describe("delete-cash-value", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-cash-value")({ cashValueId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent cash value", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-cash-value")({ cashValueId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should delete a cash value record", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const cv = await cashValuesRepo.create({
      policyId: policy.id,
      policyYear: 1,
      value: 5000,
    });

    const result = await getHandler(tools, "delete-cash-value")({ cashValueId: cv.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await cashValuesRepo.findById(cv.id)).toBeUndefined();
  });
});
