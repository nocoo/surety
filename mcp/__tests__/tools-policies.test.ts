/**
 * Unit Tests: MCP Tools - Policies
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@surety/db";
import {
  membersRepo,
  policiesRepo,
  assetsRepo,
  beneficiariesRepo,
  insurersRepo,
  paymentsRepo,
  cashValuesRepo,
  coverageItemsRepo,
  settingsRepo,
} from "@surety/db/repositories";
import { registerPolicyTools } from "../tools/policies";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerPolicyTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

async function seedData() {
  const dad = await membersRepo.create({
    name: "Zhang San",
    relation: "Self",
    gender: "M",
  });
  const mom = await membersRepo.create({
    name: "Li Si",
    relation: "Spouse",
    gender: "F",
  });
  const car = await assetsRepo.create({
    type: "Vehicle",
    name: "Tesla Model Y",
    identifier: "京A12345",
    ownerId: dad.id,
  });

  const lifePolicy = await policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Member",
    insuredMemberId: dad.id,
    category: "Life",
    insurerName: "China Life",
    productName: "Term Life 30",
    policyNumber: "POL-001",
    sumAssured: 1000000,
    premium: 3000,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-01-01",
    status: "Active",
  });

  const medicalPolicy = await policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Member",
    insuredMemberId: mom.id,
    category: "Medical",
    insurerName: "Ping An",
    productName: "Million Medical",
    policyNumber: "POL-002",
    sumAssured: 2000000,
    premium: 600,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-03-01",
    status: "Active",
  });

  const lapsedPolicy = await policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Member",
    insuredMemberId: dad.id,
    category: "Accident",
    insurerName: "PICC",
    productName: "Accident Basic",
    policyNumber: "POL-003",
    sumAssured: 500000,
    premium: 200,
    paymentFrequency: "Yearly",
    effectiveDate: "2022-01-01",
    status: "Lapsed",
  });

  const propertyPolicy = await policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Asset",
    insuredAssetId: car.id,
    category: "Property",
    insurerName: "CPIC",
    productName: "Auto Insurance",
    policyNumber: "POL-004",
    sumAssured: 300000,
    premium: 5000,
    paymentFrequency: "Yearly",
    effectiveDate: "2025-01-01",
    status: "Active",
  });

  return { dad, mom, car, lifePolicy, medicalPolicy, lapsedPolicy, propertyPolicy };
}

describe("list-policies", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-policies")({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return empty array when no policies exist", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-policies")({});
    const data = parseResult(result);
    expect(data).toEqual([]);
  });

  test("should return all policies with enriched names", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedData();

    const result = await getHandler(tools, "list-policies")({});
    const data = parseResult(result);

    expect(data).toHaveLength(4);
    // Check enrichment
    const life = data.find((p: Record<string, unknown>) => p.policyNumber === "POL-001");
    expect(life.applicantName).toBe("Zhang San");
    expect(life.insuredName).toBe("Zhang San");

    const property = data.find((p: Record<string, unknown>) => p.policyNumber === "POL-004");
    expect(property.insuredAssetName).toBe("Tesla Model Y");
    expect(property.applicantName).toBe(dad.name);
  });

  test("should filter by status", async () => {
    const tools = setup();
    await enableMcp();
    await seedData();

    const result = await getHandler(tools, "list-policies")({
      status: "Lapsed",
    });
    const data = parseResult(result);

    expect(data).toHaveLength(1);
    expect(data[0].policyNumber).toBe("POL-003");
    expect(data[0].status).toBe("Lapsed");
  });

  test("should filter by category", async () => {
    const tools = setup();
    await enableMcp();
    await seedData();

    const result = await getHandler(tools, "list-policies")({
      category: "Medical",
    });
    const data = parseResult(result);

    expect(data).toHaveLength(1);
    expect(data[0].productName).toBe("Million Medical");
  });

  test("should filter by memberId (insured or applicant)", async () => {
    const tools = setup();
    await enableMcp();
    const { mom } = await seedData();

    const result = await getHandler(tools, "list-policies")({
      memberId: mom.id,
    });
    const data = parseResult(result);

    // mom is insured on POL-002
    expect(data).toHaveLength(1);
    expect(data[0].policyNumber).toBe("POL-002");
  });

  test("should combine multiple filters", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedData();

    const result = await getHandler(tools, "list-policies")({
      status: "Active",
      memberId: dad.id,
    });
    const data = parseResult(result);

    // dad is applicant on all 4, insured on POL-001 and POL-003
    // Active + dad's involvement: POL-001 (insured), POL-002 (applicant), POL-004 (applicant)
    expect(data).toHaveLength(3);
    expect(data.every((p: Record<string, unknown>) => p.status === "Active")).toBe(true);
  });
});

describe("get-policy", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-policy")({ policyId: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-policy")({ policyId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return full policy details", async () => {
    const tools = setup();
    await enableMcp();
    const { lifePolicy } = await seedData();

    const result = await getHandler(tools, "get-policy")({
      policyId: lifePolicy.id,
    });
    const data = parseResult(result);

    expect(data.id).toBe(lifePolicy.id);
    expect(data.productName).toBe("Term Life 30");
    expect(data.category).toBe("Life");
    expect(data.insurerName).toBe("China Life");
    expect(data.premium).toBe(3000);
    expect(data.sumAssured).toBe(1000000);
    expect(data.applicantName).toBe("Zhang San");
    expect(data.insuredName).toBe("Zhang San");
    expect(data.beneficiaries).toEqual([]);
  });

  test("should return policy with asset details", async () => {
    const tools = setup();
    await enableMcp();
    const { propertyPolicy } = await seedData();

    const result = await getHandler(tools, "get-policy")({
      policyId: propertyPolicy.id,
    });
    const data = parseResult(result);

    expect(data.insuredAssetName).toBe("Tesla Model Y");
    expect(data.category).toBe("Property");
  });

  test("should include beneficiaries with member names", async () => {
    const tools = setup();
    await enableMcp();
    const { lifePolicy, mom } = await seedData();

    await beneficiariesRepo.create({
      policyId: lifePolicy.id,
      memberId: mom.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await getHandler(tools, "get-policy")({
      policyId: lifePolicy.id,
    });
    const data = parseResult(result);

    expect(data.beneficiaries).toHaveLength(1);
    expect(data.beneficiaries[0].name).toBe("Li Si");
    expect(data.beneficiaries[0].sharePercent).toBe(100);
    expect(data.beneficiaries[0].rankOrder).toBe(1);
  });

  test("should include beneficiaries with external names", async () => {
    const tools = setup();
    await enableMcp();
    const { lifePolicy } = await seedData();

    await beneficiariesRepo.create({
      policyId: lifePolicy.id,
      externalName: "Wang Wu",
      sharePercent: 50,
      rankOrder: 2,
    });

    const result = await getHandler(tools, "get-policy")({
      policyId: lifePolicy.id,
    });
    const data = parseResult(result);

    expect(data.beneficiaries).toHaveLength(1);
    expect(data.beneficiaries[0].name).toBe("Wang Wu");
  });
});

describe("create-policy", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-policy")({
      applicantId: 1,
      insuredType: "Member",
      insuredMemberId: 1,
      category: "Life",
      insurerName: "Test",
      productName: "Test",
      policyNumber: "POL-NEW",
      sumAssured: 100000,
      premium: 1000,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-01-01",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should create a member-insured policy", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedData();

    const result = await getHandler(tools, "create-policy")({
      applicantId: dad.id,
      insuredType: "Member",
      insuredMemberId: dad.id,
      category: "CriticalIllness",
      insurerName: "China Life",
      productName: "CI Guard",
      policyNumber: "POL-NEW-001",
      sumAssured: 500000,
      premium: 8000,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-06-01",
    });
    const data = parseResult(result);

    expect(data.id).toBeDefined();
    expect(data.category).toBe("CriticalIllness");
    expect(data.insuredMemberId).toBe(dad.id);
    expect(data.insuredAssetId).toBeNull();
    expect(data.status).toBe("Active");
  });

  test("should create an asset-insured policy", async () => {
    const tools = setup();
    await enableMcp();
    const { dad, car } = await seedData();

    const result = await getHandler(tools, "create-policy")({
      applicantId: dad.id,
      insuredType: "Asset",
      insuredAssetId: car.id,
      category: "Property",
      insurerName: "CPIC",
      productName: "Auto Plus",
      policyNumber: "POL-NEW-002",
      sumAssured: 500000,
      premium: 6000,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-06-01",
    });
    const data = parseResult(result);

    expect(data.insuredAssetId).toBe(car.id);
    expect(data.insuredMemberId).toBeNull();
  });

  test("should auto-create insurer via findOrCreate", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedData();

    await getHandler(tools, "create-policy")({
      applicantId: dad.id,
      insuredType: "Member",
      insuredMemberId: dad.id,
      category: "Life",
      insurerName: "Brand New Insurer",
      productName: "New Product",
      policyNumber: "POL-NEW-003",
      sumAssured: 100000,
      premium: 1000,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-06-01",
    });

    const insurer = await insurersRepo.findByName("Brand New Insurer");
    expect(insurer).toBeDefined();
  });

  test("should reject Member insuredType without insuredMemberId", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedData();

    const result = await getHandler(tools, "create-policy")({
      applicantId: dad.id,
      insuredType: "Member",
      // insuredMemberId missing
      category: "Life",
      insurerName: "Test",
      productName: "Test",
      policyNumber: "POL-FAIL",
      sumAssured: 100000,
      premium: 1000,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-01-01",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("insuredMemberId is required");
  });

  test("should reject Asset insuredType without insuredAssetId", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedData();

    const result = await getHandler(tools, "create-policy")({
      applicantId: dad.id,
      insuredType: "Asset",
      // insuredAssetId missing
      category: "Property",
      insurerName: "Test",
      productName: "Test",
      policyNumber: "POL-FAIL-2",
      sumAssured: 100000,
      premium: 1000,
      paymentFrequency: "Yearly",
      effectiveDate: "2025-01-01",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("insuredAssetId is required");
  });
});

describe("update-policy", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-policy")({
      policyId: 1,
      premium: 5000,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "update-policy")({
      policyId: 999,
      premium: 5000,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should update basic fields", async () => {
    const tools = setup();
    await enableMcp();
    const { lifePolicy } = await seedData();

    const result = await getHandler(tools, "update-policy")({
      policyId: lifePolicy.id,
      premium: 3500,
      notes: "Premium increased",
    });
    const data = parseResult(result);

    expect(data.premium).toBe(3500);
    expect(data.notes).toBe("Premium increased");
    expect(data.productName).toBe("Term Life 30"); // unchanged
  });

  test("should switch insuredType from Member to Asset and clear opposing FK", async () => {
    const tools = setup();
    await enableMcp();
    const { lifePolicy, car } = await seedData();

    const result = await getHandler(tools, "update-policy")({
      policyId: lifePolicy.id,
      insuredType: "Asset",
      insuredAssetId: car.id,
    });
    const data = parseResult(result);

    expect(data.insuredType).toBe("Asset");
    expect(data.insuredAssetId).toBe(car.id);
    expect(data.insuredMemberId).toBeNull();
  });

  test("should sync insurerId when insurerName changes", async () => {
    const tools = setup();
    await enableMcp();
    const { lifePolicy } = await seedData();

    const result = await getHandler(tools, "update-policy")({
      policyId: lifePolicy.id,
      insurerName: "New Insurer Co",
    });
    const data = parseResult(result);

    expect(data.insurerName).toBe("New Insurer Co");
    // insurerId should point to the new insurer
    const insurer = await insurersRepo.findByName("New Insurer Co");
    expect(insurer).toBeDefined();
    expect(data.insurerId).toBe(insurer?.id);
  });

  test("should reject insuredType=Member without insuredMemberId", async () => {
    const tools = setup();
    await enableMcp();
    const { propertyPolicy } = await seedData();

    const result = await getHandler(tools, "update-policy")({
      policyId: propertyPolicy.id,
      insuredType: "Member",
      // missing insuredMemberId
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("insuredMemberId is required");
  });
});

describe("delete-policy", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-policy")({ policyId: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "delete-policy")({ policyId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should cascade delete policy and all child records", async () => {
    const tools = setup();
    await enableMcp();
    const { lifePolicy, mom } = await seedData();

    // Create child records
    await beneficiariesRepo.create({
      policyId: lifePolicy.id,
      memberId: mom.id,
      sharePercent: 100,
      rankOrder: 1,
    });
    await paymentsRepo.create({
      policyId: lifePolicy.id,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
      status: "Paid",
    });
    await cashValuesRepo.create({
      policyId: lifePolicy.id,
      policyYear: 1,
      value: 1500,
    });
    await coverageItemsRepo.create({
      policyId: lifePolicy.id,
      name: "Death Benefit",
      sortOrder: 0,
    });

    const result = await getHandler(tools, "delete-policy")({
      policyId: lifePolicy.id,
    });
    const data = parseResult(result);

    expect(data.deleted).toBe(true);
    expect(data.id).toBe(lifePolicy.id);

    // Verify cascade
    expect(await policiesRepo.findById(lifePolicy.id)).toBeUndefined();
    expect(await beneficiariesRepo.findByPolicyId(lifePolicy.id)).toHaveLength(0);
    expect(await paymentsRepo.findByPolicyId(lifePolicy.id)).toHaveLength(0);
    expect(await cashValuesRepo.findByPolicyId(lifePolicy.id)).toHaveLength(0);
    expect(await coverageItemsRepo.findByPolicyId(lifePolicy.id)).toHaveLength(0);
  });
});
