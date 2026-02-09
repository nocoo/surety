/**
 * Unit Tests: MCP Tools - Policies
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import {
  membersRepo,
  policiesRepo,
  assetsRepo,
  beneficiariesRepo,
  settingsRepo,
} from "@/db/repositories";
import { registerPolicyTools } from "../tools/policies";
import { createMockServer, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerPolicyTools(server);
  return tools;
}

function enableMcp() {
  settingsRepo.set("mcp.enabled", "true");
}

function seedData() {
  const dad = membersRepo.create({
    name: "Zhang San",
    relation: "Self",
    gender: "M",
  });
  const mom = membersRepo.create({
    name: "Li Si",
    relation: "Spouse",
    gender: "F",
  });
  const car = assetsRepo.create({
    type: "Vehicle",
    name: "Tesla Model Y",
    identifier: "京A12345",
    ownerId: dad.id,
  });

  const lifePolicy = policiesRepo.create({
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

  const medicalPolicy = policiesRepo.create({
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

  const lapsedPolicy = policiesRepo.create({
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

  const propertyPolicy = policiesRepo.create({
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
    const result = await tools.get("list-policies")!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return empty array when no policies exist", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools.get("list-policies")!.handler({});
    const data = parseResult(result);
    expect(data).toEqual([]);
  });

  test("should return all policies with enriched names", async () => {
    const tools = setup();
    enableMcp();
    const { dad } = seedData();

    const result = await tools.get("list-policies")!.handler({});
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
    enableMcp();
    seedData();

    const result = await tools
      .get("list-policies")!
      .handler({ status: "Lapsed" });
    const data = parseResult(result);

    expect(data).toHaveLength(1);
    expect(data[0].policyNumber).toBe("POL-003");
    expect(data[0].status).toBe("Lapsed");
  });

  test("should filter by category", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools
      .get("list-policies")!
      .handler({ category: "Medical" });
    const data = parseResult(result);

    expect(data).toHaveLength(1);
    expect(data[0].productName).toBe("Million Medical");
  });

  test("should filter by memberId (insured or applicant)", async () => {
    const tools = setup();
    enableMcp();
    const { mom } = seedData();

    const result = await tools
      .get("list-policies")!
      .handler({ memberId: mom.id });
    const data = parseResult(result);

    // mom is insured on POL-002
    expect(data).toHaveLength(1);
    expect(data[0].policyNumber).toBe("POL-002");
  });

  test("should combine multiple filters", async () => {
    const tools = setup();
    enableMcp();
    const { dad } = seedData();

    const result = await tools
      .get("list-policies")!
      .handler({ status: "Active", memberId: dad.id });
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
    const result = await tools
      .get("get-policy")!
      .handler({ policyId: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools
      .get("get-policy")!
      .handler({ policyId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return full policy details", async () => {
    const tools = setup();
    enableMcp();
    const { lifePolicy } = seedData();

    const result = await tools
      .get("get-policy")!
      .handler({ policyId: lifePolicy.id });
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
    enableMcp();
    const { propertyPolicy } = seedData();

    const result = await tools
      .get("get-policy")!
      .handler({ policyId: propertyPolicy.id });
    const data = parseResult(result);

    expect(data.insuredAssetName).toBe("Tesla Model Y");
    expect(data.category).toBe("Property");
  });

  test("should include beneficiaries with member names", async () => {
    const tools = setup();
    enableMcp();
    const { lifePolicy, mom } = seedData();

    beneficiariesRepo.create({
      policyId: lifePolicy.id,
      memberId: mom.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await tools
      .get("get-policy")!
      .handler({ policyId: lifePolicy.id });
    const data = parseResult(result);

    expect(data.beneficiaries).toHaveLength(1);
    expect(data.beneficiaries[0].name).toBe("Li Si");
    expect(data.beneficiaries[0].sharePercent).toBe(100);
    expect(data.beneficiaries[0].rankOrder).toBe(1);
  });

  test("should include beneficiaries with external names", async () => {
    const tools = setup();
    enableMcp();
    const { lifePolicy } = seedData();

    beneficiariesRepo.create({
      policyId: lifePolicy.id,
      externalName: "Wang Wu",
      sharePercent: 50,
      rankOrder: 2,
    });

    const result = await tools
      .get("get-policy")!
      .handler({ policyId: lifePolicy.id });
    const data = parseResult(result);

    expect(data.beneficiaries).toHaveLength(1);
    expect(data.beneficiaries[0].name).toBe("Wang Wu");
  });
});
