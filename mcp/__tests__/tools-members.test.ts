/**
 * Unit Tests: MCP Tools - Members
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import {
  membersRepo,
  policiesRepo,
  beneficiariesRepo,
  assetsRepo,
  settingsRepo,
  hospitalsRepo,
  medicalVisitsRepo,
} from "@/db/repositories";
import { registerMemberTools } from "../tools/members";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerMemberTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

async function seedMembers() {
  const dad = await membersRepo.create({
    name: "Zhang San",
    relation: "Self",
    gender: "M",
    birthDate: "1986-03-15",
    phone: "13800001111",
  });
  const mom = await membersRepo.create({
    name: "Li Si",
    relation: "Spouse",
    gender: "F",
    birthDate: "1988-07-20",
  });
  const kid = await membersRepo.create({
    name: "Zhang Xiao",
    relation: "Child",
    gender: "M",
    birthDate: "2018-01-10",
  });
  return { dad, mom, kid };
}

describe("list-members", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const handler = getHandler(tools, "list-members");
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return empty array when no members exist", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-members")({});
    const data = parseResult(result);
    expect(data).toEqual([]);
  });

  test("should return all members with correct fields", async () => {
    const tools = setup();
    await enableMcp();
    const { dad, mom } = await seedMembers();

    const result = await getHandler(tools, "list-members")({});
    const data = parseResult(result);

    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({
      id: dad.id,
      name: "Zhang San",
      relation: "Self",
      gender: "M",
      birthDate: "1986-03-15",
      phone: "13800001111",
    });
    expect(data[1]).toEqual({
      id: mom.id,
      name: "Li Si",
      relation: "Spouse",
      gender: "F",
      birthDate: "1988-07-20",
      phone: null,
    });
  });

  test("should not expose sensitive fields like idCard", async () => {
    const tools = setup();
    await enableMcp();
    await membersRepo.create({
      name: "Test User",
      relation: "Self",
      idCard: "310101199001011234",
    });

    const result = await getHandler(tools, "list-members")({});
    const data = parseResult(result);
    expect(data[0]).not.toHaveProperty("idCard");
    expect(data[0]).not.toHaveProperty("createdAt");
    expect(data[0]).not.toHaveProperty("updatedAt");
  });
});

describe("get-member", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-member")({ memberId: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent member", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-member")({ memberId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return member with empty policies when none exist", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedMembers();

    const result = await getHandler(tools, "get-member")({
      memberId: dad.id,
    });
    const data = parseResult(result);

    expect(data.name).toBe("Zhang San");
    expect(data.relation).toBe("Self");
    expect(data.policies).toEqual([]);
  });

  test("should return member with related policies as insured", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedMembers();

    const policy = await policiesRepo.create({
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

    const result = await getHandler(tools, "get-member")({
      memberId: dad.id,
    });
    const data = parseResult(result);

    expect(data.policies).toHaveLength(1);
    expect(data.policies[0].id).toBe(policy.id);
    expect(data.policies[0].productName).toBe("Term Life 30");
    expect(data.policies[0].role).toBe("insured");
  });

  test("should return member with related policies as applicant", async () => {
    const tools = setup();
    await enableMcp();
    const { dad, kid } = await seedMembers();

    await policiesRepo.create({
      applicantId: dad.id,
      insuredType: "Member",
      insuredMemberId: kid.id,
      category: "Medical",
      insurerName: "Ping An",
      productName: "Kids Medical",
      policyNumber: "POL-002",
      sumAssured: 2000000,
      premium: 800,
      paymentFrequency: "Yearly",
      effectiveDate: "2024-06-01",
      status: "Active",
    });

    const result = await getHandler(tools, "get-member")({
      memberId: dad.id,
    });
    const data = parseResult(result);

    expect(data.policies).toHaveLength(1);
    expect(data.policies[0].role).toBe("applicant");
  });

  test("should deduplicate policies where member is both applicant and insured", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedMembers();

    await policiesRepo.create({
      applicantId: dad.id,
      insuredType: "Member",
      insuredMemberId: dad.id,
      category: "Accident",
      insurerName: "PICC",
      productName: "Accident Plus",
      policyNumber: "POL-003",
      sumAssured: 500000,
      premium: 200,
      paymentFrequency: "Yearly",
      effectiveDate: "2024-01-01",
      status: "Active",
    });

    const result = await getHandler(tools, "get-member")({
      memberId: dad.id,
    });
    const data = parseResult(result);

    // Should appear only once despite being both applicant and insured
    expect(data.policies).toHaveLength(1);
    expect(data.policies[0].role).toBe("insured");
  });
});

describe("create-member", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-member")({
      name: "Test",
      relation: "Self",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should create a member with required fields", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "create-member")({
      name: "Wang Wu",
      relation: "Parent",
    });
    const data = parseResult(result);

    expect(data.id).toBeDefined();
    expect(data.name).toBe("Wang Wu");
    expect(data.relation).toBe("Parent");
  });

  test("should create a member with all fields", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "create-member")({
      name: "Zhang San",
      relation: "Self",
      gender: "M",
      birthDate: "1986-03-15",
      idCard: "310101198603151234",
      idType: "身份证",
      idExpiry: "2021-10-05|2041-10-05",
      phone: "13800001111",
      hasSocialInsurance: true,
    });
    const data = parseResult(result);

    expect(data.name).toBe("Zhang San");
    expect(data.gender).toBe("M");
    expect(data.birthDate).toBe("1986-03-15");
    expect(data.idCard).toBe("310101198603151234");
    expect(data.phone).toBe("13800001111");
    expect(data.hasSocialInsurance).toBe(true);
  });
});

describe("update-member", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-member")({
      memberId: 1,
      name: "Updated",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent member", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "update-member")({
      memberId: 999,
      name: "Updated",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should update member fields", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedMembers();

    const result = await getHandler(tools, "update-member")({
      memberId: dad.id,
      name: "Zhang San Updated",
      phone: "13900009999",
    });
    const data = parseResult(result);

    expect(data.name).toBe("Zhang San Updated");
    expect(data.phone).toBe("13900009999");
    // Unchanged fields should remain
    expect(data.relation).toBe("Self");
    expect(data.gender).toBe("M");
  });
});

describe("delete-member", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-member")({ memberId: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent member", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "delete-member")({ memberId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should delete an unreferenced member", async () => {
    const tools = setup();
    await enableMcp();
    const { kid } = await seedMembers();

    const result = await getHandler(tools, "delete-member")({
      memberId: kid.id,
    });
    const data = parseResult(result);

    expect(data.deleted).toBe(true);
    expect(data.id).toBe(kid.id);

    // Verify deleted
    const found = await membersRepo.findById(kid.id);
    expect(found).toBeUndefined();
  });

  test("should refuse to delete member referenced as policy applicant", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedMembers();

    await policiesRepo.create({
      applicantId: dad.id,
      insuredType: "Member",
      insuredMemberId: dad.id,
      category: "Life",
      insurerName: "China Life",
      productName: "Term Life",
      policyNumber: "POL-001",
      sumAssured: 1000000,
      premium: 3000,
      paymentFrequency: "Yearly",
      effectiveDate: "2024-01-01",
      status: "Active",
    });

    const result = await getHandler(tools, "delete-member")({
      memberId: dad.id,
    });
    expect(result.isError).toBe(true);

    const data = parseResult(result);
    expect(data.error).toContain("still referenced");
    expect(data.asApplicant).toHaveLength(1);
    expect(data.asApplicant[0].policyNumber).toBe("POL-001");
  });

  test("should refuse to delete member referenced as beneficiary", async () => {
    const tools = setup();
    await enableMcp();
    const { dad, mom } = await seedMembers();

    const policy = await policiesRepo.create({
      applicantId: dad.id,
      insuredType: "Member",
      insuredMemberId: dad.id,
      category: "Life",
      insurerName: "China Life",
      productName: "Term Life",
      policyNumber: "POL-001",
      sumAssured: 1000000,
      premium: 3000,
      paymentFrequency: "Yearly",
      effectiveDate: "2024-01-01",
      status: "Active",
    });

    await beneficiariesRepo.create({
      policyId: policy.id,
      memberId: mom.id,
      sharePercent: 100,
      rankOrder: 1,
    });

    const result = await getHandler(tools, "delete-member")({
      memberId: mom.id,
    });
    expect(result.isError).toBe(true);

    const data = parseResult(result);
    expect(data.error).toContain("still referenced");
    expect(data.asBeneficiary).toHaveLength(1);
  });

  test("should refuse to delete member who owns assets", async () => {
    const tools = setup();
    await enableMcp();
    const { dad } = await seedMembers();

    await assetsRepo.create({
      type: "Vehicle",
      name: "Tesla Model 3",
      identifier: "沪A12345",
      ownerId: dad.id,
    });

    const result = await getHandler(tools, "delete-member")({
      memberId: dad.id,
    });
    expect(result.isError).toBe(true);

    const data = parseResult(result);
    expect(data.error).toContain("still referenced");
    expect(data.ownedAssets).toHaveLength(1);
    expect(data.ownedAssets[0].name).toBe("Tesla Model 3");
  });

  test("should refuse to delete member who has medical visits", async () => {
    const tools = setup();
    await enableMcp();
    const { kid } = await seedMembers();

    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    await medicalVisitsRepo.create({
      memberId: kid.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-15",
      visitType: "儿保",
      visitReason: "Routine checkup",
    });

    const result = await getHandler(tools, "delete-member")({
      memberId: kid.id,
    });
    expect(result.isError).toBe(true);

    const data = parseResult(result);
    expect(data.error).toContain("still referenced");
    expect(data.medicalVisitCount).toBe(1);
    expect(data.medicalVisits).toHaveLength(1);
    expect(data.medicalVisits[0].visitDate).toBe("2024-01-15");
  });
});
