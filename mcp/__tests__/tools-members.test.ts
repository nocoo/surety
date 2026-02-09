/**
 * Unit Tests: MCP Tools - Members
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import {
  membersRepo,
  policiesRepo,
  settingsRepo,
} from "@/db/repositories";
import { registerMemberTools } from "../tools/members";
import { createMockServer, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerMemberTools(server);
  return tools;
}

function enableMcp() {
  settingsRepo.set("mcp.enabled", "true");
}

function seedMembers() {
  const dad = membersRepo.create({
    name: "Zhang San",
    relation: "Self",
    gender: "M",
    birthDate: "1986-03-15",
    phone: "13800001111",
  });
  const mom = membersRepo.create({
    name: "Li Si",
    relation: "Spouse",
    gender: "F",
    birthDate: "1988-07-20",
  });
  const kid = membersRepo.create({
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
    const handler = tools.get("list-members")!.handler;
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return empty array when no members exist", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools.get("list-members")!.handler({});
    const data = parseResult(result);
    expect(data).toEqual([]);
  });

  test("should return all members with correct fields", async () => {
    const tools = setup();
    enableMcp();
    const { dad, mom } = seedMembers();

    const result = await tools.get("list-members")!.handler({});
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
    enableMcp();
    membersRepo.create({
      name: "Test User",
      relation: "Self",
      idCard: "310101199001011234",
    });

    const result = await tools.get("list-members")!.handler({});
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
    const result = await tools.get("get-member")!.handler({ memberId: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MCP access is disabled");
  });

  test("should return error for non-existent member", async () => {
    const tools = setup();
    enableMcp();
    const result = await tools.get("get-member")!.handler({ memberId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return member with empty policies when none exist", async () => {
    const tools = setup();
    enableMcp();
    const { dad } = seedMembers();

    const result = await tools.get("get-member")!.handler({
      memberId: dad.id,
    });
    const data = parseResult(result);

    expect(data.name).toBe("Zhang San");
    expect(data.relation).toBe("Self");
    expect(data.policies).toEqual([]);
  });

  test("should return member with related policies as insured", async () => {
    const tools = setup();
    enableMcp();
    const { dad } = seedMembers();

    const policy = policiesRepo.create({
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

    const result = await tools.get("get-member")!.handler({
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
    enableMcp();
    const { dad, kid } = seedMembers();

    policiesRepo.create({
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

    const result = await tools.get("get-member")!.handler({
      memberId: dad.id,
    });
    const data = parseResult(result);

    expect(data.policies).toHaveLength(1);
    expect(data.policies[0].role).toBe("applicant");
  });

  test("should deduplicate policies where member is both applicant and insured", async () => {
    const tools = setup();
    enableMcp();
    const { dad } = seedMembers();

    policiesRepo.create({
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

    const result = await tools.get("get-member")!.handler({
      memberId: dad.id,
    });
    const data = parseResult(result);

    // Should appear only once despite being both applicant and insured
    expect(data.policies).toHaveLength(1);
    expect(data.policies[0].role).toBe("insured");
  });
});
