/**
 * Unit Tests: MCP Tools - Doctors
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@surety/db";
import {
  hospitalsRepo,
  doctorsRepo,
  medicalVisitsRepo,
  membersRepo,
  settingsRepo,
} from "@surety/db/repositories";
import { registerDoctorTools } from "../src/tools/doctors";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerDoctorTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

describe("list-doctors", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-doctors")({});
    expect(result.isError).toBe(true);
  });

  test("should return empty array when no doctors exist", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-doctors")({});
    expect(parseResult(result)).toEqual([]);
  });

  test("should return all doctors with hospital names and visit counts", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({ name: "Dr. A", hospitalId: hospital.id, department: "Internal" });
    await doctorsRepo.create({ name: "Dr. B", hospitalId: hospital.id, department: "Surgery" });

    // Add visits for Dr. A
    const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "list-doctors")({});
    const data = parseResult(result);
    expect(data).toHaveLength(2);
    expect(data[0].hospitalName).toBe("Test Hospital");
    expect(data[0].visitCount).toBe(1);
    expect(data[1].visitCount).toBe(0);
  });

  test("should filter by hospitalId", async () => {
    const tools = setup();
    await enableMcp();
    const h1 = await hospitalsRepo.create({ name: "Hospital A" });
    const h2 = await hospitalsRepo.create({ name: "Hospital B" });
    await doctorsRepo.create({ name: "Dr. A", hospitalId: h1.id, department: "Internal" });
    await doctorsRepo.create({ name: "Dr. B", hospitalId: h2.id, department: "Surgery" });

    const result = await getHandler(tools, "list-doctors")({ hospitalId: h1.id });
    const data = parseResult(result);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Dr. A");
  });
});

describe("get-doctor", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-doctor")({ doctorId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent doctor", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-doctor")({ doctorId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return doctor details with hospital name and visit count", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({
      name: "Dr. Test",
      hospitalId: hospital.id,
      department: "Cardiology",
      title: "主任医师",
      specialty: "Heart surgery",
    });

    const result = await getHandler(tools, "get-doctor")({ doctorId: doctor.id });
    const data = parseResult(result);
    expect(data.name).toBe("Dr. Test");
    expect(data.hospitalName).toBe("Test Hospital");
    expect(data.department).toBe("Cardiology");
    expect(data.visitCount).toBe(0);
  });
});

describe("create-doctor", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-doctor")({
      name: "Dr. Test",
      hospitalId: 1,
      department: "Internal",
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent hospital", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "create-doctor")({
      name: "Dr. Test",
      hospitalId: 999,
      department: "Internal",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Hospital with id 999 not found");
  });

  test("should reject empty string for required name field", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });

    const result = await getHandler(tools, "create-doctor")({
      name: "",
      hospitalId: hospital.id,
      department: "Internal",
    });
    expect(result.isError).toBe(true);
  });

  test("should reject empty string for required department field", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });

    const result = await getHandler(tools, "create-doctor")({
      name: "Dr. Test",
      hospitalId: hospital.id,
      department: "",
    });
    expect(result.isError).toBe(true);
  });

  test("should create a doctor with required fields", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });

    const result = await getHandler(tools, "create-doctor")({
      name: "Dr. New",
      hospitalId: hospital.id,
      department: "Internal Medicine",
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.name).toBe("Dr. New");
    expect(data.hospitalName).toBe("Test Hospital");
    expect(data.department).toBe("Internal Medicine");
  });

  test("should create a doctor with all fields", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });

    const result = await getHandler(tools, "create-doctor")({
      name: "Dr. Full",
      hospitalId: hospital.id,
      department: "Cardiology",
      title: "主任医师",
      specialty: "Heart surgery",
      phone: "13800138000",
      notes: "Expert in minimally invasive surgery",
    });
    const data = parseResult(result);
    expect(data.title).toBe("主任医师");
    expect(data.specialty).toBe("Heart surgery");
    expect(data.phone).toBe("13800138000");
  });
});

describe("update-doctor", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-doctor")({ doctorId: 1, name: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent doctor", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-doctor")({ doctorId: 999, name: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent hospital when updating hospitalId", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({ name: "Dr. Test", hospitalId: hospital.id, department: "Internal" });

    const result = await getHandler(tools, "update-doctor")({ doctorId: doctor.id, hospitalId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Hospital with id 999 not found");
  });

  test("should return error when department is empty", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({ name: "Dr. Test", hospitalId: hospital.id, department: "Internal" });

    const result = await getHandler(tools, "update-doctor")({ doctorId: doctor.id, department: "  " });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Department cannot be empty");
  });

  test("should update doctor fields", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({ name: "Old Name", hospitalId: hospital.id, department: "Internal" });

    const result = await getHandler(tools, "update-doctor")({
      doctorId: doctor.id,
      name: "New Name",
      title: "副主任医师",
    });
    const data = parseResult(result);
    expect(data.name).toBe("New Name");
    expect(data.title).toBe("副主任医师");
    expect(data.hospitalName).toBe("Test Hospital");
  });

  test("should update doctor hospital", async () => {
    const tools = setup();
    await enableMcp();
    const h1 = await hospitalsRepo.create({ name: "Hospital A" });
    const h2 = await hospitalsRepo.create({ name: "Hospital B" });
    const doctor = await doctorsRepo.create({ name: "Dr. Test", hospitalId: h1.id, department: "Internal" });

    const result = await getHandler(tools, "update-doctor")({
      doctorId: doctor.id,
      hospitalId: h2.id,
    });
    const data = parseResult(result);
    expect(data.hospitalId).toBe(h2.id);
    expect(data.hospitalName).toBe("Hospital B");
  });

  test("should refuse to change hospital when doctor has medical visits", async () => {
    const tools = setup();
    await enableMcp();
    const h1 = await hospitalsRepo.create({ name: "Hospital A" });
    const h2 = await hospitalsRepo.create({ name: "Hospital B" });
    const doctor = await doctorsRepo.create({ name: "Dr. Test", hospitalId: h1.id, department: "Internal" });
    const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: h1.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "update-doctor")({
      doctorId: doctor.id,
      hospitalId: h2.id,
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("Cannot change hospital");
    expect(data.visitCount).toBe(1);
  });

  test("should clear nullable fields when passing null", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({
      name: "Dr. Test",
      hospitalId: hospital.id,
      department: "Internal",
      title: "主任医师",
      specialty: "Heart surgery",
      phone: "13800138000",
      notes: "Expert",
    });

    const result = await getHandler(tools, "update-doctor")({
      doctorId: doctor.id,
      title: null,
      specialty: null,
      phone: null,
      notes: null,
    });
    const data = parseResult(result);
    expect(data.title).toBeNull();
    expect(data.specialty).toBeNull();
    expect(data.phone).toBeNull();
    expect(data.notes).toBeNull();
    // Required fields remain unchanged
    expect(data.name).toBe("Dr. Test");
    expect(data.department).toBe("Internal");
  });
});

describe("delete-doctor", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-doctor")({ doctorId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent doctor", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-doctor")({ doctorId: 999 });
    expect(result.isError).toBe(true);
  });

  test("should delete an unreferenced doctor", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({ name: "Delete Me", hospitalId: hospital.id, department: "Internal" });

    const result = await getHandler(tools, "delete-doctor")({ doctorId: doctor.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await doctorsRepo.findById(doctor.id)).toBeUndefined();
  });

  test("should refuse to delete doctor referenced by medical visits", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const doctor = await doctorsRepo.create({ name: "Has Visits", hospitalId: hospital.id, department: "Internal" });
    const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "delete-doctor")({ doctorId: doctor.id });
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("still referenced by medical visits");
    expect(data.visitCount).toBe(1);
  });
});
