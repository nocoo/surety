/**
 * Unit Tests: MCP Tools - Hospitals
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import {
  hospitalsRepo,
  doctorsRepo,
  medicalVisitsRepo,
  membersRepo,
  settingsRepo,
} from "@/db/repositories";
import { registerHospitalTools } from "../tools/hospitals";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerHospitalTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

describe("list-hospitals", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-hospitals")({});
    expect(result.isError).toBe(true);
  });

  test("should return empty array when no hospitals exist", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-hospitals")({});
    expect(parseResult(result)).toEqual([]);
  });

  test("should return all hospitals with doctor counts", async () => {
    const tools = setup();
    await enableMcp();
    const h1 = await hospitalsRepo.create({ name: "Hospital A", level: "三甲" });
    await hospitalsRepo.create({ name: "Hospital B", level: "二甲" });
    await doctorsRepo.create({ name: "Dr. A", hospitalId: h1.id, department: "Internal" });
    await doctorsRepo.create({ name: "Dr. B", hospitalId: h1.id, department: "Surgery" });

    const result = await getHandler(tools, "list-hospitals")({});
    const data = parseResult(result);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Hospital A");
    expect(data[0].doctorCount).toBe(2);
    expect(data[1].name).toBe("Hospital B");
    expect(data[1].doctorCount).toBe(0);
  });
});

describe("get-hospital", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-hospital")({ hospitalId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent hospital", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-hospital")({ hospitalId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return hospital details with doctors", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital", level: "三甲" });
    await doctorsRepo.create({ name: "Dr. Test", hospitalId: hospital.id, department: "Cardiology", title: "主任医师" });

    const result = await getHandler(tools, "get-hospital")({ hospitalId: hospital.id });
    const data = parseResult(result);
    expect(data.name).toBe("Test Hospital");
    expect(data.doctors).toHaveLength(1);
    expect(data.doctors[0].name).toBe("Dr. Test");
    expect(data.doctors[0].department).toBe("Cardiology");
  });
});

describe("create-hospital", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-hospital")({ name: "Test" });
    expect(result.isError).toBe(true);
  });

  test("should create a hospital with minimal fields", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "create-hospital")({ name: "New Hospital" });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.name).toBe("New Hospital");
  });

  test("should create a hospital with all fields", async () => {
    const tools = setup();
    await enableMcp();

    const result = await getHandler(tools, "create-hospital")({
      name: "Full Hospital",
      level: "三甲",
      isPublic: true,
      address: "123 Main St",
      phone: "400-123-4567",
      notes: "Test notes",
    });
    const data = parseResult(result);
    expect(data.name).toBe("Full Hospital");
    expect(data.level).toBe("三甲");
    expect(data.isPublic).toBe(true);
    expect(data.address).toBe("123 Main St");
  });
});

describe("update-hospital", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-hospital")({ hospitalId: 1, name: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent hospital", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-hospital")({ hospitalId: 999, name: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should update hospital fields", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Old Name" });

    const result = await getHandler(tools, "update-hospital")({
      hospitalId: hospital.id,
      name: "New Name",
      level: "二甲",
    });
    const data = parseResult(result);
    expect(data.name).toBe("New Name");
    expect(data.level).toBe("二甲");
  });
});

describe("delete-hospital", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-hospital")({ hospitalId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent hospital", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-hospital")({ hospitalId: 999 });
    expect(result.isError).toBe(true);
  });

  test("should delete an unreferenced hospital", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Delete Me" });

    const result = await getHandler(tools, "delete-hospital")({ hospitalId: hospital.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await hospitalsRepo.findById(hospital.id)).toBeUndefined();
  });

  test("should refuse to delete hospital referenced by doctors", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Has Doctors" });
    await doctorsRepo.create({ name: "Dr. Test", hospitalId: hospital.id, department: "Internal" });

    const result = await getHandler(tools, "delete-hospital")({ hospitalId: hospital.id });
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("still referenced by doctors");
    expect(data.doctorCount).toBe(1);
  });

  test("should refuse to delete hospital referenced by medical visits", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Has Visits" });
    const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "delete-hospital")({ hospitalId: hospital.id });
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("still referenced by medical visits");
  });
});
