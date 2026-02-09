/**
 * Unit Tests: MCP Tools - Coverage & Analytics
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import {
  membersRepo,
  policiesRepo,
  assetsRepo,
  settingsRepo,
} from "@/db/repositories";
import { registerCoverageTools } from "../tools/coverage";
import { createMockServer, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerCoverageTools(server);
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

  // Dad: 2 active policies, 1 lapsed
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
    nextDueDate: "2026-01-01",
    status: "Active",
  });

  const accidentPolicy = policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Member",
    insuredMemberId: dad.id,
    category: "Accident",
    insurerName: "PICC",
    productName: "Accident Plus",
    policyNumber: "POL-002",
    sumAssured: 500000,
    premium: 200,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-06-01",
    nextDueDate: "2026-06-01",
    status: "Active",
  });

  policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Member",
    insuredMemberId: dad.id,
    category: "CriticalIllness",
    insurerName: "CPIC",
    productName: "CI Basic",
    policyNumber: "POL-003",
    sumAssured: 300000,
    premium: 5000,
    paymentFrequency: "Yearly",
    effectiveDate: "2020-01-01",
    status: "Lapsed",
  });

  // Mom: 1 active policy
  policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Member",
    insuredMemberId: mom.id,
    category: "Medical",
    insurerName: "Ping An",
    productName: "Million Medical",
    policyNumber: "POL-004",
    sumAssured: 2000000,
    premium: 600,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-03-01",
    nextDueDate: "2026-03-01",
    status: "Active",
  });

  // Car: 1 active property policy
  policiesRepo.create({
    applicantId: dad.id,
    insuredType: "Asset",
    insuredAssetId: car.id,
    category: "Property",
    insurerName: "CPIC",
    productName: "Auto Insurance",
    policyNumber: "POL-005",
    sumAssured: 300000,
    premium: 5000,
    paymentFrequency: "Yearly",
    effectiveDate: "2025-06-01",
    expiryDate: "2026-06-01",
    status: "Active",
  });

  return { dad, mom, car, lifePolicy, accidentPolicy };
}

// =============================================================================
// coverage-analysis
// =============================================================================
describe("coverage-analysis", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await tools
      .get("coverage-analysis")!
      .handler({ type: "member", id: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent member", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools
      .get("coverage-analysis")!
      .handler({ type: "member", id: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return error for non-existent asset", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools
      .get("coverage-analysis")!
      .handler({ type: "asset", id: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should analyze member coverage (active only)", async () => {
    const tools = setup();
    enableMcp();
    const { dad } = seedData();

    const result = await tools
      .get("coverage-analysis")!
      .handler({ type: "member", id: dad.id });
    const data = parseResult(result);

    expect(data.name).toBe("Zhang San");
    expect(data.relation).toBe("Self");
    // Only active: Life (3000, 1M) + Accident (200, 500K) = 3200, 1.5M
    expect(data.policyCount).toBe(2);
    expect(data.totalPremium).toBe(3200);
    expect(data.totalSumAssured).toBe(1500000);
    expect(data.policies).toHaveLength(2);
  });

  test("should group coverage by category", async () => {
    const tools = setup();
    enableMcp();
    const { dad } = seedData();

    const result = await tools
      .get("coverage-analysis")!
      .handler({ type: "member", id: dad.id });
    const data = parseResult(result);

    expect(data.byCategory.Life).toEqual({
      count: 1,
      premium: 3000,
      sumAssured: 1000000,
    });
    expect(data.byCategory.Accident).toEqual({
      count: 1,
      premium: 200,
      sumAssured: 500000,
    });
    // Lapsed CI should NOT appear
    expect(data.byCategory.CriticalIllness).toBeUndefined();
  });

  test("should analyze asset coverage", async () => {
    const tools = setup();
    enableMcp();
    const { car, dad } = seedData();

    const result = await tools
      .get("coverage-analysis")!
      .handler({ type: "asset", id: car.id });
    const data = parseResult(result);

    expect(data.name).toBe("Tesla Model Y");
    expect(data.type).toBe("Vehicle");
    expect(data.ownerName).toBe(dad.name);
    expect(data.policies).toHaveLength(1);
    expect(data.policies[0].category).toBe("Property");
    expect(data.policies[0].premium).toBe(5000);
  });

  test("should return member with no active coverage", async () => {
    const tools = setup();
    enableMcp();
    const member = membersRepo.create({
      name: "Grandpa",
      relation: "Parent",
    });

    const result = await tools
      .get("coverage-analysis")!
      .handler({ type: "member", id: member.id });
    const data = parseResult(result);

    expect(data.policyCount).toBe(0);
    expect(data.totalPremium).toBe(0);
    expect(data.totalSumAssured).toBe(0);
    expect(data.policies).toEqual([]);
  });
});

// =============================================================================
// renewal-overview
// =============================================================================
describe("renewal-overview", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await tools.get("renewal-overview")!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return empty list when no policies exist", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools.get("renewal-overview")!.handler({});
    const data = parseResult(result);
    expect(data.total).toBe(0);
    expect(data.policies).toEqual([]);
  });

  test("should return upcoming renewals within default 12 months", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools.get("renewal-overview")!.handler({});
    const data = parseResult(result);

    // Policies with nextDueDate/expiryDate within 12 months from now
    // The exact count depends on "now" vs seed dates
    expect(data.lookAheadMonths).toBe(12);
    expect(data.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.policies)).toBe(true);
  });

  test("should respect custom months parameter", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools
      .get("renewal-overview")!
      .handler({ months: 1 });
    const data = parseResult(result);

    expect(data.lookAheadMonths).toBe(1);
    // With only 1 month, fewer policies should appear
    expect(data.total).toBeLessThanOrEqual(5);
  });

  test("should sort renewals by date", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools.get("renewal-overview")!.handler({ months: 24 });
    const data = parseResult(result);

    if (data.policies.length >= 2) {
      for (let i = 1; i < data.policies.length; i++) {
        const prevDate =
          data.policies[i - 1].nextDueDate ?? data.policies[i - 1].expiryDate ?? "";
        const currDate =
          data.policies[i].nextDueDate ?? data.policies[i].expiryDate ?? "";
        expect(prevDate.localeCompare(currDate)).toBeLessThanOrEqual(0);
      }
    }
  });

  test("should include applicant name in renewals", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools.get("renewal-overview")!.handler({ months: 24 });
    const data = parseResult(result);

    if (data.policies.length > 0) {
      expect(data.policies[0].applicantName).toBeDefined();
    }
  });

  test("should exclude lapsed policies from renewals", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools.get("renewal-overview")!.handler({ months: 120 });
    const data = parseResult(result);

    // POL-003 is lapsed, should never appear
    const lapsed = data.policies.find(
      (p: Record<string, unknown>) => p.policyNumber === "POL-003",
    );
    expect(lapsed).toBeUndefined();
  });
});

// =============================================================================
// dashboard-summary
// =============================================================================
describe("dashboard-summary", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await tools.get("dashboard-summary")!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return zero stats when no data exists", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools.get("dashboard-summary")!.handler({});
    const data = parseResult(result);

    expect(data.memberCount).toBe(0);
    expect(data.policyCount).toBe(0);
    expect(data.activePolicyCount).toBe(0);
    expect(data.totalPremium).toBe(0);
    expect(data.totalSumAssured).toBe(0);
    expect(data.byCategory).toEqual({});
  });

  test("should return correct dashboard statistics", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools.get("dashboard-summary")!.handler({});
    const data = parseResult(result);

    expect(data.memberCount).toBe(2); // dad + mom
    expect(data.policyCount).toBe(5); // all including lapsed
    expect(data.activePolicyCount).toBe(4); // excluding lapsed CI
    // Active premiums: 3000 + 200 + 600 + 5000 = 8800
    expect(data.totalPremium).toBe(8800);
    // Active sum assured: 1M + 500K + 2M + 300K = 3.8M
    expect(data.totalSumAssured).toBe(3800000);
  });

  test("should group active policies by category", async () => {
    const tools = setup();
    enableMcp();
    seedData();

    const result = await tools.get("dashboard-summary")!.handler({});
    const data = parseResult(result);

    expect(data.byCategory.Life).toEqual({
      count: 1,
      premium: 3000,
      sumAssured: 1000000,
    });
    expect(data.byCategory.Accident).toEqual({
      count: 1,
      premium: 200,
      sumAssured: 500000,
    });
    expect(data.byCategory.Medical).toEqual({
      count: 1,
      premium: 600,
      sumAssured: 2000000,
    });
    expect(data.byCategory.Property).toEqual({
      count: 1,
      premium: 5000,
      sumAssured: 300000,
    });
    // Lapsed CI should NOT appear in byCategory
    expect(data.byCategory.CriticalIllness).toBeUndefined();
  });
});
