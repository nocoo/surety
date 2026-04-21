import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface MedicalVisit {
  id: number;
  memberId: number;
  memberName?: string | null;
  hospitalId: number;
  hospitalName?: string | null;
  doctorId: number | null;
  doctorName?: string | null;
  visitDate: string;
  visitTimeStart?: string | null;
  visitTimeEnd?: string | null;
  visitType: string;
  visitReason: string;
  department: string | null;
  symptoms?: string | null;
  diagnosis: string | null;
  treatment: string | null;
  totalCost: number | null;
  insurancePaid: number | null;
  selfPaid: number | null;
  notes: string | null;
}

describe("Medical Visits API E2E", () => {
  let testHospitalId: number;
  let testHospital2Id: number;
  let testDoctorId: number;
  let testDoctor2Id: number;
  let testMemberId: number;

  beforeAll(async () => {
    await setupE2E();

    // Create test hospital
    const { data: h1 } = await apiRequest<{ id: number }>("/api/hospitals", {
      method: "POST",
      body: JSON.stringify({ name: `E2E就诊测试医院1-${Date.now()}` }),
    });
    testHospitalId = h1.id;

    const { data: h2 } = await apiRequest<{ id: number }>("/api/hospitals", {
      method: "POST",
      body: JSON.stringify({ name: `E2E就诊测试医院2-${Date.now()}` }),
    });
    testHospital2Id = h2.id;

    // Create test doctors
    const { data: d1 } = await apiRequest<{ id: number }>("/api/doctors", {
      method: "POST",
      body: JSON.stringify({
        name: "E2E测试医生1",
        hospitalId: testHospitalId,
        department: "内科",
      }),
    });
    testDoctorId = d1.id;

    const { data: d2 } = await apiRequest<{ id: number }>("/api/doctors", {
      method: "POST",
      body: JSON.stringify({
        name: "E2E测试医生2",
        hospitalId: testHospital2Id,
        department: "外科",
      }),
    });
    testDoctor2Id = d2.id;

    // Create test member
    const { data: m } = await apiRequest<{ id: number }>("/api/members", {
      method: "POST",
      body: JSON.stringify({ name: "E2E就诊测试成员", relation: "Self" }),
    });
    testMemberId = m.id;
  }, 60000);

  afterAll(async () => {
    // Cleanup
    await apiRequest<{ success: boolean }>(`/api/doctors/${testDoctorId}`, {
      method: "DELETE",
    });
    await apiRequest<{ success: boolean }>(`/api/doctors/${testDoctor2Id}`, {
      method: "DELETE",
    });
    await apiRequest<{ success: boolean }>(`/api/hospitals/${testHospitalId}`, {
      method: "DELETE",
    });
    await apiRequest<{ success: boolean }>(`/api/hospitals/${testHospital2Id}`, {
      method: "DELETE",
    });
    await apiRequest<{ success: boolean }>(`/api/members/${testMemberId}`, {
      method: "DELETE",
    });
    await teardownE2E();
  });

  describe("CRUD operations", () => {
    let createdVisitId: number;

    test("GET /api/medical-visits returns list", async () => {
      const { status, data } = await apiRequest<MedicalVisit[]>("/api/medical-visits");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/medical-visits creates new visit", async () => {
      const newVisit = {
        memberId: testMemberId,
        hospitalId: testHospitalId,
        doctorId: testDoctorId,
        visitDate: "2024-06-15",
        visitTimeStart: "09:30",
        visitTimeEnd: "10:00",
        visitType: "门诊",
        visitReason: "E2E测试就诊",
        department: "内科",
        symptoms: "发烧",
        diagnosis: "普通感冒",
        treatment: "多喝水",
        totalCost: 100,
        insurancePaid: 80,
        selfPaid: 20,
      };

      const { status, data } = await apiRequest<MedicalVisit>("/api/medical-visits", {
        method: "POST",
        body: JSON.stringify(newVisit),
      });

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.memberId).toBe(testMemberId);
      expect(data.visitReason).toBe("E2E测试就诊");
      expect(data.visitTimeStart).toBe("09:30");
      expect(data.symptoms).toBe("发烧");
      createdVisitId = data.id;
    });

    test("GET /api/medical-visits/:id returns single visit", async () => {
      const { status, data } = await apiRequest<MedicalVisit>(
        `/api/medical-visits/${createdVisitId}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(createdVisitId);
      expect(data.memberName).toBeDefined();
      expect(data.hospitalName).toBeDefined();
      expect(data.doctorName).toBeDefined();
    });

    test("GET /api/medical-visits?memberId filters by member", async () => {
      const { status, data } = await apiRequest<MedicalVisit[]>(
        `/api/medical-visits?memberId=${testMemberId}`
      );

      expect(status).toBe(200);
      expect(data.every((v) => v.memberId === testMemberId)).toBe(true);
    });

    test("PUT /api/medical-visits/:id updates visit", async () => {
      const { status, data } = await apiRequest<MedicalVisit>(
        `/api/medical-visits/${createdVisitId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            diagnosis: "病毒性感冒",
            totalCost: 150,
            insurancePaid: 120,
            selfPaid: 30,
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.diagnosis).toBe("病毒性感冒");
      expect(data.totalCost).toBe(150);
    });

    test("DELETE /api/medical-visits/:id deletes visit", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/medical-visits/${createdVisitId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest<MedicalVisit>(
        `/api/medical-visits/${createdVisitId}`
      );
      expect(getStatus).toBe(404);
    });
  });

  describe("Validation tests", () => {
    test("POST /api/medical-visits with missing memberId returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/medical-visits",
        {
          method: "POST",
          body: JSON.stringify({
            hospitalId: testHospitalId,
            visitDate: "2024-01-01",
            visitType: "门诊",
            visitReason: "测试",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("memberId");
    });

    test("POST /api/medical-visits with missing visitReason returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/medical-visits",
        {
          method: "POST",
          body: JSON.stringify({
            memberId: testMemberId,
            hospitalId: testHospitalId,
            visitDate: "2024-01-01",
            visitType: "门诊",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("visitReason");
    });

    test("POST /api/medical-visits with non-existent member returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/medical-visits",
        {
          method: "POST",
          body: JSON.stringify({
            memberId: 99999,
            hospitalId: testHospitalId,
            visitDate: "2024-01-01",
            visitType: "门诊",
            visitReason: "测试",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("成员");
    });

    test("POST /api/medical-visits with non-existent hospital returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/medical-visits",
        {
          method: "POST",
          body: JSON.stringify({
            memberId: testMemberId,
            hospitalId: 99999,
            visitDate: "2024-01-01",
            visitType: "门诊",
            visitReason: "测试",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("医院");
    });
  });

  describe("Doctor-hospital consistency", () => {
    test("POST /api/medical-visits with mismatched doctor-hospital returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/medical-visits",
        {
          method: "POST",
          body: JSON.stringify({
            memberId: testMemberId,
            hospitalId: testHospitalId,
            doctorId: testDoctor2Id, // doctor from hospital2
            visitDate: "2024-01-01",
            visitType: "门诊",
            visitReason: "测试",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("不属于");
    });

    test("PUT /api/medical-visits/:id changing hospital breaks doctor consistency returns 400", async () => {
      // Create a visit with doctor
      const { data: visit } = await apiRequest<MedicalVisit>("/api/medical-visits", {
        method: "POST",
        body: JSON.stringify({
          memberId: testMemberId,
          hospitalId: testHospitalId,
          doctorId: testDoctorId,
          visitDate: "2024-01-01",
          visitType: "门诊",
          visitReason: "测试",
        }),
      });

      // Try to change hospital while keeping the doctor
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/medical-visits/${visit.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ hospitalId: testHospital2Id }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("不属于");

      // Cleanup
      await apiRequest<{ success: boolean }>(`/api/medical-visits/${visit.id}`, {
        method: "DELETE",
      });
    });
  });

  describe("Cost consistency", () => {
    test("POST /api/medical-visits with inconsistent costs returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/medical-visits",
        {
          method: "POST",
          body: JSON.stringify({
            memberId: testMemberId,
            hospitalId: testHospitalId,
            visitDate: "2024-01-01",
            visitType: "门诊",
            visitReason: "测试",
            totalCost: 100,
            insurancePaid: 60,
            selfPaid: 50, // 60 + 50 = 110 != 100
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("不一致");
    });
  });

  describe("Member update validation", () => {
    test("PUT /api/medical-visits/:id with non-existent memberId returns 400", async () => {
      // Create a visit
      const { data: visit } = await apiRequest<MedicalVisit>("/api/medical-visits", {
        method: "POST",
        body: JSON.stringify({
          memberId: testMemberId,
          hospitalId: testHospitalId,
          visitDate: "2024-01-01",
          visitType: "门诊",
          visitReason: "测试",
        }),
      });

      // Try to update with non-existent member
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/medical-visits/${visit.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ memberId: 99999 }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("成员");

      // Cleanup
      await apiRequest<{ success: boolean }>(`/api/medical-visits/${visit.id}`, {
        method: "DELETE",
      });
    });
  });

  describe("Member delete constraint", () => {
    let constraintMemberId: number;
    let constraintVisitId: number;

    test("setup: create member with visit", async () => {
      const { data: member } = await apiRequest<{ id: number }>("/api/members", {
        method: "POST",
        body: JSON.stringify({ name: "E2E约束测试成员", relation: "Child" }),
      });
      constraintMemberId = member.id;

      const { data: visit } = await apiRequest<MedicalVisit>("/api/medical-visits", {
        method: "POST",
        body: JSON.stringify({
          memberId: constraintMemberId,
          hospitalId: testHospitalId,
          visitDate: "2024-01-01",
          visitType: "儿保",
          visitReason: "常规检查",
        }),
      });
      constraintVisitId = visit.id;
    });

    test("DELETE /api/members/:id with visits returns 409", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/members/${constraintMemberId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("就诊记录");
    });

    test("cleanup: delete visit then member", async () => {
      await apiRequest<{ success: boolean }>(`/api/medical-visits/${constraintVisitId}`, {
        method: "DELETE",
      });
      const { status } = await apiRequest<{ success: boolean }>(
        `/api/members/${constraintMemberId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
    });
  });
});
