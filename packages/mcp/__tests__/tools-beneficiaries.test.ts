/**
 * Unit Tests: MCP Tools - Beneficiaries
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@surety/db";
import {
  beneficiariesRepo,
  membersRepo,
  policiesRepo,
  insurersRepo,
  settingsRepo,
} from "@surety/db/repositories";
import { registerBeneficiaryTools } from "../src/tools/beneficiaries";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerBeneficiaryTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

/** Create a member + insurer + policy for beneficiary tests */
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
    productName: "Term Life",
    policyNumber: "POL-001",
    sumAssured: 1000000,
    premium: 3000,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-01-01",
    status: "Active",
  });
  return { member, insurer, policy };
}

describe("list-beneficiaries", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-beneficiaries")({ policyId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-beneficiaries")({ policyId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return empty array when policy has no beneficiaries", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "list-beneficiaries")({ policyId: policy.id });
    expect(parseResult(result)).toEqual([]);
  });

  test("should return beneficiaries with member names", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await getHandler(tools, "list-beneficiaries")({ policyId: policy.id });
    const data = parseResult(result);
    expect(data).toHaveLength(1);
    expect(data[0].memberName).toBe("Zhang San");
    expect(data[0].sharePercent).toBe(100);
    expect(data[0].rankOrder).toBe(1);
  });

  test("should return external beneficiaries without member name", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    await beneficiariesRepo.create({
      policyId: policy.id,
      externalName: "Wang Wu",
      externalIdCard: "110101199901011234",
      sharePercent: 50,
      rankOrder: 2,
    });

    const result = await getHandler(tools, "list-beneficiaries")({ policyId: policy.id });
    const data = parseResult(result);
    expect(data).toHaveLength(1);
    expect(data[0].externalName).toBe("Wang Wu");
    expect(data[0].memberName).toBeUndefined();
  });
});

describe("get-beneficiary", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-beneficiary")({ beneficiaryId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-beneficiary")({ beneficiaryId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return beneficiary details with member name", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const beneficiary = await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await getHandler(tools, "get-beneficiary")({ beneficiaryId: beneficiary.id });
    const data = parseResult(result);
    expect(data.id).toBe(beneficiary.id);
    expect(data.memberName).toBe("Zhang San");
    expect(data.sharePercent).toBe(100);
  });
});

describe("create-beneficiary", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-beneficiary")({
      policyId: 1,
      memberId: 1,
      sharePercent: 100,
      rankOrder: 1,
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "create-beneficiary")({
      policyId: 999,
      memberId: 1,
      sharePercent: 100,
      rankOrder: 1,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Policy with id 999 not found");
  });

  test("should return error for non-existent member", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-beneficiary")({
      policyId: policy.id,
      memberId: 999,
      sharePercent: 100,
      rankOrder: 1,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Member with id 999 not found");
  });

  test("should create beneficiary with member reference", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const result = await getHandler(tools, "create-beneficiary")({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.policyId).toBe(policy.id);
    expect(data.memberId).toBe(member.id);
    expect(data.sharePercent).toBe(100);
  });

  test("should create external beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-beneficiary")({
      policyId: policy.id,
      externalName: "Li Si",
      externalIdCard: "310101200001011234",
      sharePercent: 50,
      rankOrder: 1,
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.externalName).toBe("Li Si");
    expect(data.externalIdCard).toBe("310101200001011234");
  });

  test("should reject when neither memberId nor externalName provided", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-beneficiary")({
      policyId: policy.id,
      sharePercent: 100,
      rankOrder: 1,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Either memberId or externalName is required");
  });

  test("should reject when both memberId and externalName provided", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const result = await getHandler(tools, "create-beneficiary")({
      policyId: policy.id,
      memberId: member.id,
      externalName: "Li Si",
      sharePercent: 100,
      rankOrder: 1,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cannot set both memberId and externalName");
  });
});

describe("update-beneficiary", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-beneficiary")({
      beneficiaryId: 1,
      sharePercent: 50,
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-beneficiary")({
      beneficiaryId: 999,
      sharePercent: 50,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should update beneficiary fields", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const beneficiary = await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await getHandler(tools, "update-beneficiary")({
      beneficiaryId: beneficiary.id,
      sharePercent: 60,
      rankOrder: 2,
    });
    const data = parseResult(result);
    expect(data.sharePercent).toBe(60);
    expect(data.rankOrder).toBe(2);
    expect(data.memberId).toBe(member.id); // unchanged
  });

  test("should return error for non-existent memberId", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const beneficiary = await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await getHandler(tools, "update-beneficiary")({
      beneficiaryId: beneficiary.id,
      memberId: 999,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Member with id 999 not found");
  });

  test("should reject update that creates contradictory identity", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const beneficiary = await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    // Try to add externalName while memberId already exists (without clearing memberId)
    const result = await getHandler(tools, "update-beneficiary")({
      beneficiaryId: beneficiary.id,
      externalName: "Li Si",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cannot set both memberId and externalName");
  });

  test("should switch from member to external beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const beneficiary = await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    // Switch identity: clear memberId, set externalName
    const result = await getHandler(tools, "update-beneficiary")({
      beneficiaryId: beneficiary.id,
      memberId: null,
      externalName: "Wang Wu",
      externalIdCard: "110101199901011234",
    });
    const data = parseResult(result);
    expect(data.memberId).toBeNull();
    expect(data.externalName).toBe("Wang Wu");
  });

  test("should switch from external to member beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const beneficiary = await beneficiariesRepo.create({
      policyId: policy.id,
      externalName: "Wang Wu",
      sharePercent: 100,
      rankOrder: 1,
    });

    // Switch identity: set memberId, clear external fields
    const result = await getHandler(tools, "update-beneficiary")({
      beneficiaryId: beneficiary.id,
      memberId: member.id,
      externalName: null,
      externalIdCard: null,
    });
    const data = parseResult(result);
    expect(data.memberId).toBe(member.id);
    expect(data.externalName).toBeNull();
  });
});

describe("delete-beneficiary", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-beneficiary")({ beneficiaryId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-beneficiary")({ beneficiaryId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should delete a beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const { member, policy } = await seedPolicy();

    const beneficiary = await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: member.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await getHandler(tools, "delete-beneficiary")({ beneficiaryId: beneficiary.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await beneficiariesRepo.findById(beneficiary.id)).toBeUndefined();
  });
});
