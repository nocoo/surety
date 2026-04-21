/**
 * Unit Tests: MCP Tools - Medical Visits
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
import { registerMedicalVisitTools } from "../src/tools/medical-visits";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerMedicalVisitTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

async function createTestData() {
  const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
  const doctor = await doctorsRepo.create({ name: "Dr. Test", hospitalId: hospital.id, department: "Internal" });
  const member = await membersRepo.create({ name: "Zhang San", relation: "Self", birthDate: "1990-01-01" });
  return { hospital, doctor, member };
}

describe("list-medical-visits", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-medical-visits")({});
    expect(result.isError).toBe(true);
  });

  test("should return empty array when no visits exist", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-medical-visits")({});
    expect(parseResult(result)).toEqual([]);
  });

  test("should return all visits with related names", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, doctor, member } = await createTestData();
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Fever",
    });

    const result = await getHandler(tools, "list-medical-visits")({});
    const data = parseResult(result);
    expect(data).toHaveLength(1);
    expect(data[0].memberName).toBe("Zhang San");
    expect(data[0].hospitalName).toBe("Test Hospital");
    expect(data[0].doctorName).toBe("Dr. Test");
  });

  test("should filter by memberId", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const member2 = await membersRepo.create({ name: "Li Si", relation: "Spouse" });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    await medicalVisitsRepo.create({
      memberId: member2.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-02",
      visitType: "门诊",
      visitReason: "Cold",
    });

    const result = await getHandler(tools, "list-medical-visits")({ memberId: member.id });
    const data = parseResult(result);
    expect(data).toHaveLength(1);
    expect(data[0].memberName).toBe("Zhang San");
  });

  test("should filter by hospitalId", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const hospital2 = await hospitalsRepo.create({ name: "Hospital B" });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital2.id,
      visitDate: "2024-01-02",
      visitType: "急诊",
      visitReason: "Emergency",
    });

    const result = await getHandler(tools, "list-medical-visits")({ hospitalId: hospital2.id });
    const data = parseResult(result);
    expect(data).toHaveLength(1);
    expect(data[0].hospitalName).toBe("Hospital B");
  });

  test("should filter by doctorId", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, doctor, member } = await createTestData();
    const doctor2 = await doctorsRepo.create({ name: "Dr. B", hospitalId: hospital.id, department: "Surgery" });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor2.id,
      visitDate: "2024-01-02",
      visitType: "门诊",
      visitReason: "Surgery consult",
    });

    const result = await getHandler(tools, "list-medical-visits")({ doctorId: doctor2.id });
    const data = parseResult(result);
    expect(data).toHaveLength(1);
    expect(data[0].doctorName).toBe("Dr. B");
  });
});

describe("get-medical-visit", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-medical-visit")({ visitId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent visit", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-medical-visit")({ visitId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return visit details with related names", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, doctor, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Fever and cough",
      diagnosis: "Common cold",
      totalCost: 200,
      insurancePaid: 150,
      selfPaid: 50,
    });

    const result = await getHandler(tools, "get-medical-visit")({ visitId: visit.id });
    const data = parseResult(result);
    expect(data.memberName).toBe("Zhang San");
    expect(data.memberBirthDate).toBe("1990-01-01");
    expect(data.hospitalName).toBe("Test Hospital");
    expect(data.doctorName).toBe("Dr. Test");
    expect(data.visitReason).toBe("Fever and cough");
    expect(data.diagnosis).toBe("Common cold");
  });
});

describe("create-medical-visit", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-medical-visit")({
      memberId: 1,
      hospitalId: 1,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent member", async () => {
    const tools = setup();
    await enableMcp();
    const hospital = await hospitalsRepo.create({ name: "Test Hospital" });
    const result = await getHandler(tools, "create-medical-visit")({
      memberId: 999,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Member with id 999 not found");
  });

  test("should return error for non-existent hospital", async () => {
    const tools = setup();
    await enableMcp();
    const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
    const result = await getHandler(tools, "create-medical-visit")({
      memberId: member.id,
      hospitalId: 999,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Hospital with id 999 not found");
  });

  test("should return error for non-existent doctor", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const result = await getHandler(tools, "create-medical-visit")({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: 999,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Doctor with id 999 not found");
  });

  test("should return error when doctor does not belong to hospital", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const otherHospital = await hospitalsRepo.create({ name: "Other Hospital" });
    const otherDoctor = await doctorsRepo.create({ name: "Dr. Other", hospitalId: otherHospital.id, department: "Internal" });

    const result = await getHandler(tools, "create-medical-visit")({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: otherDoctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Doctor does not belong to the specified hospital");
  });

  test("should return error for cost inconsistency", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const result = await getHandler(tools, "create-medical-visit")({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
      totalCost: 100,
      insurancePaid: 50,
      selfPaid: 60, // 50 + 60 = 110 != 100
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cost inconsistency");
  });

  test("should reject empty string for required visitReason field", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const result = await getHandler(tools, "create-medical-visit")({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "",
    });
    expect(result.isError).toBe(true);
  });

  test("should create a visit with required fields", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();

    const result = await getHandler(tools, "create-medical-visit")({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Annual checkup",
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.memberName).toBe("Zhang San");
    expect(data.hospitalName).toBe("Test Hospital");
    expect(data.visitReason).toBe("Annual checkup");
  });

  test("should create a visit with all fields", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, doctor, member } = await createTestData();

    const result = await getHandler(tools, "create-medical-visit")({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-15",
      visitType: "门诊",
      visitReason: "Persistent cough",
      department: "Respiratory",
      diagnosis: "Bronchitis",
      treatment: "Antibiotics prescribed",
      totalCost: 300,
      insurancePaid: 240,
      selfPaid: 60,
      notes: "Follow-up in 2 weeks",
    });
    const data = parseResult(result);
    expect(data.doctorName).toBe("Dr. Test");
    expect(data.diagnosis).toBe("Bronchitis");
    expect(data.totalCost).toBe(300);
  });
});

describe("update-medical-visit", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-medical-visit")({ visitId: 1, diagnosis: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent visit", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-medical-visit")({ visitId: 999, diagnosis: "Updated" });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent hospital when updating hospitalId", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "update-medical-visit")({ visitId: visit.id, hospitalId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Hospital with id 999 not found");
  });

  test("should return error for non-existent member when updating memberId", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "update-medical-visit")({ visitId: visit.id, memberId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Member with id 999 not found");
  });

  test("should return error when doctor does not belong to hospital", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const otherHospital = await hospitalsRepo.create({ name: "Other Hospital" });
    const otherDoctor = await doctorsRepo.create({ name: "Dr. Other", hospitalId: otherHospital.id, department: "Internal" });
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "update-medical-visit")({
      visitId: visit.id,
      doctorId: otherDoctor.id,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Doctor does not belong to the specified hospital");
  });

  test("should return error when changing hospital breaks doctor-hospital consistency", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, doctor, member } = await createTestData();
    const otherHospital = await hospitalsRepo.create({ name: "Other Hospital" });
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    // Try to change hospital while keeping the doctor from original hospital
    const result = await getHandler(tools, "update-medical-visit")({
      visitId: visit.id,
      hospitalId: otherHospital.id,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Doctor does not belong to the specified hospital");
  });

  test("should return error for cost inconsistency", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
      totalCost: 100,
      insurancePaid: 80,
      selfPaid: 20,
    });

    const result = await getHandler(tools, "update-medical-visit")({
      visitId: visit.id,
      selfPaid: 30, // 80 + 30 = 110 != 100
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cost inconsistency");
  });

  test("should update visit fields", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "update-medical-visit")({
      visitId: visit.id,
      diagnosis: "Healthy",
      notes: "All clear",
    });
    const data = parseResult(result);
    expect(data.diagnosis).toBe("Healthy");
    expect(data.notes).toBe("All clear");
  });

  test("should clear doctor when setting doctorId to null", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, doctor, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      doctorId: doctor.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "update-medical-visit")({
      visitId: visit.id,
      doctorId: null,
    });
    const data = parseResult(result);
    expect(data.doctorId).toBeNull();
    expect(data.doctorName).toBeNull();
  });

  test("should clear nullable fields when passing null", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
      department: "Internal",
      diagnosis: "Healthy",
      treatment: "None",
      notes: "All good",
    });

    const result = await getHandler(tools, "update-medical-visit")({
      visitId: visit.id,
      department: null,
      diagnosis: null,
      treatment: null,
      notes: null,
    });
    const data = parseResult(result);
    expect(data.department).toBeNull();
    expect(data.diagnosis).toBeNull();
    expect(data.treatment).toBeNull();
    expect(data.notes).toBeNull();
    // Required fields remain unchanged
    expect(data.visitReason).toBe("Checkup");
  });
});

describe("delete-medical-visit", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-medical-visit")({ visitId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent visit", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-medical-visit")({ visitId: 999 });
    expect(result.isError).toBe(true);
  });

  test("should delete a visit", async () => {
    const tools = setup();
    await enableMcp();
    const { hospital, member } = await createTestData();
    const visit = await medicalVisitsRepo.create({
      memberId: member.id,
      hospitalId: hospital.id,
      visitDate: "2024-01-01",
      visitType: "门诊",
      visitReason: "Checkup",
    });

    const result = await getHandler(tools, "delete-medical-visit")({ visitId: visit.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await medicalVisitsRepo.findById(visit.id)).toBeUndefined();
  });
});
