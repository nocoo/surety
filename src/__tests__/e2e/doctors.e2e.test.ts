import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface Doctor {
  id: number;
  name: string;
  hospitalId: number;
  hospitalName?: string | null;
  department: string | null;
  title: string | null;
  specialty: string | null;
  phone: string | null;
  notes: string | null;
  visitCount?: number;
}

interface Hospital {
  id: number;
  name: string;
}

describe("Doctors API E2E", () => {
  let testHospitalId: number;
  let testHospital2Id: number;

  beforeAll(async () => {
    await setupE2E();
    // Create test hospitals
    const { data: h1 } = await apiRequest<Hospital>("/api/hospitals", {
      method: "POST",
      body: JSON.stringify({ name: `E2E医生测试医院1-${Date.now()}` }),
    });
    testHospitalId = h1.id;

    const { data: h2 } = await apiRequest<Hospital>("/api/hospitals", {
      method: "POST",
      body: JSON.stringify({ name: `E2E医生测试医院2-${Date.now()}` }),
    });
    testHospital2Id = h2.id;
  }, 60000);

  afterAll(async () => {
    // Cleanup hospitals
    await apiRequest<{ success: boolean }>(`/api/hospitals/${testHospitalId}`, {
      method: "DELETE",
    });
    await apiRequest<{ success: boolean }>(`/api/hospitals/${testHospital2Id}`, {
      method: "DELETE",
    });
    await teardownE2E();
  });

  describe("CRUD operations", () => {
    let createdDoctorId: number;

    test("GET /api/doctors returns list", async () => {
      const { status, data } = await apiRequest<Doctor[]>("/api/doctors");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/doctors creates new doctor", async () => {
      const newDoctor = {
        name: `E2E测试医生-${Date.now()}`,
        hospitalId: testHospitalId,
        department: "内科",
        title: "主任医师",
        specialty: "心血管",
      };

      const { status, data } = await apiRequest<Doctor>("/api/doctors", {
        method: "POST",
        body: JSON.stringify(newDoctor),
      });

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.name).toBe(newDoctor.name);
      expect(data.hospitalId).toBe(testHospitalId);
      expect(data.department).toBe("内科");
      createdDoctorId = data.id;
    });

    test("GET /api/doctors/:id returns single doctor", async () => {
      const { status, data } = await apiRequest<Doctor>(
        `/api/doctors/${createdDoctorId}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(createdDoctorId);
      expect(data.hospitalName).toBeDefined();
    });

    test("GET /api/doctors?hospitalId filters by hospital", async () => {
      const { status, data } = await apiRequest<Doctor[]>(
        `/api/doctors?hospitalId=${testHospitalId}`
      );

      expect(status).toBe(200);
      expect(data.every((d) => d.hospitalId === testHospitalId)).toBe(true);
    });

    test("PUT /api/doctors/:id updates doctor", async () => {
      const { status, data } = await apiRequest<Doctor>(
        `/api/doctors/${createdDoctorId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: "副主任医师",
            phone: "13800138000",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.title).toBe("副主任医师");
      expect(data.phone).toBe("13800138000");
    });

    test("DELETE /api/doctors/:id deletes doctor", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/doctors/${createdDoctorId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest<Doctor>(
        `/api/doctors/${createdDoctorId}`
      );
      expect(getStatus).toBe(404);
    });
  });

  describe("Validation tests", () => {
    test("POST /api/doctors with missing name returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/doctors",
        {
          method: "POST",
          body: JSON.stringify({ hospitalId: testHospitalId, department: "内科" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("name");
    });

    test("POST /api/doctors with missing hospitalId returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/doctors",
        {
          method: "POST",
          body: JSON.stringify({ name: "测试", department: "内科" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("hospitalId");
    });

    test("POST /api/doctors with missing department returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/doctors",
        {
          method: "POST",
          body: JSON.stringify({ name: "测试", hospitalId: testHospitalId }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("department");
    });

    test("POST /api/doctors with non-existent hospital returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/doctors",
        {
          method: "POST",
          body: JSON.stringify({
            name: "测试",
            hospitalId: 99999,
            department: "内科",
          }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("Hospital");
    });

    test("PUT /api/doctors/:id with empty department returns 400", async () => {
      // Create a doctor first
      const { data: doctor } = await apiRequest<Doctor>("/api/doctors", {
        method: "POST",
        body: JSON.stringify({
          name: "E2E空科室测试",
          hospitalId: testHospitalId,
          department: "内科",
        }),
      });

      const { status, data } = await apiRequest<{ error: string }>(
        `/api/doctors/${doctor.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ department: "" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("科室");

      // Cleanup
      await apiRequest<{ success: boolean }>(`/api/doctors/${doctor.id}`, {
        method: "DELETE",
      });
    });
  });

  describe("Hospital change constraint", () => {
    let doctorId: number;
    let memberId: number;
    let visitId: number;

    test("setup: create doctor, member, and visit", async () => {
      const { data: doctor } = await apiRequest<Doctor>("/api/doctors", {
        method: "POST",
        body: JSON.stringify({
          name: `E2E就诊约束医生-${Date.now()}`,
          hospitalId: testHospitalId,
          department: "内科",
        }),
      });
      doctorId = doctor.id;

      const { data: member } = await apiRequest<{ id: number }>("/api/members", {
        method: "POST",
        body: JSON.stringify({ name: "E2E测试成员", relation: "Self" }),
      });
      memberId = member.id;

      const { data: visit } = await apiRequest<{ id: number }>("/api/medical-visits", {
        method: "POST",
        body: JSON.stringify({
          memberId,
          hospitalId: testHospitalId,
          doctorId,
          visitDate: "2024-01-01",
          visitType: "门诊",
          visitReason: "测试",
        }),
      });
      visitId = visit.id;
    });

    test("PUT /api/doctors/:id cannot change hospital when has visits", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/doctors/${doctorId}`,
        {
          method: "PUT",
          body: JSON.stringify({ hospitalId: testHospital2Id }),
        }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("就诊记录");
    });

    test("DELETE /api/doctors/:id with visits returns 409", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/doctors/${doctorId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("就诊记录");
    });

    test("cleanup: delete visit, member, then doctor", async () => {
      await apiRequest<{ success: boolean }>(`/api/medical-visits/${visitId}`, {
        method: "DELETE",
      });
      await apiRequest<{ success: boolean }>(`/api/members/${memberId}`, {
        method: "DELETE",
      });
      const { status } = await apiRequest<{ success: boolean }>(
        `/api/doctors/${doctorId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
    });
  });
});
