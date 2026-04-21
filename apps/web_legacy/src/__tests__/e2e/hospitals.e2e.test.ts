import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface Hospital {
  id: number;
  name: string;
  level: string | null;
  isPublic: boolean;
  address: string | null;
  phone: string | null;
  notes: string | null;
  doctorCount?: number;
}

describe("Hospitals API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("CRUD operations", () => {
    let createdHospitalId: number;

    test("GET /api/hospitals returns list", async () => {
      const { status, data } = await apiRequest<Hospital[]>("/api/hospitals");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/hospitals creates new hospital", async () => {
      const newHospital = {
        name: `E2E测试医院-${Date.now()}`,
        level: "三甲",
        isPublic: true,
        address: "测试地址",
        phone: "010-12345678",
      };

      const { status, data } = await apiRequest<Hospital>("/api/hospitals", {
        method: "POST",
        body: JSON.stringify(newHospital),
      });

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.name).toBe(newHospital.name);
      expect(data.level).toBe("三甲");
      expect(data.isPublic).toBe(true);
      createdHospitalId = data.id;
    });

    test("GET /api/hospitals/:id returns single hospital", async () => {
      const { status, data } = await apiRequest<Hospital>(
        `/api/hospitals/${createdHospitalId}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(createdHospitalId);
    });

    test("PUT /api/hospitals/:id updates hospital", async () => {
      const { status, data } = await apiRequest<Hospital>(
        `/api/hospitals/${createdHospitalId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            level: "二甲",
            phone: "010-87654321",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.level).toBe("二甲");
      expect(data.phone).toBe("010-87654321");
    });

    test("DELETE /api/hospitals/:id deletes hospital", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/hospitals/${createdHospitalId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest<Hospital>(
        `/api/hospitals/${createdHospitalId}`
      );
      expect(getStatus).toBe(404);
    });
  });

  describe("Error handling", () => {
    test("POST /api/hospitals with missing name returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/hospitals",
        {
          method: "POST",
          body: JSON.stringify({ level: "三甲" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("name");
    });

    test("GET /api/hospitals/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/hospitals/invalid"
      );
      expect(status).toBe(400);
    });

    test("GET /api/hospitals/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/hospitals/99999"
      );
      expect(status).toBe(404);
    });
  });

  describe("FK constraint tests", () => {
    let hospitalId: number;
    let doctorId: number;

    test("setup: create hospital and doctor", async () => {
      const { data: hospital } = await apiRequest<Hospital>("/api/hospitals", {
        method: "POST",
        body: JSON.stringify({ name: `E2E约束测试医院-${Date.now()}` }),
      });
      hospitalId = hospital.id;

      const { data: doctor } = await apiRequest<{ id: number }>("/api/doctors", {
        method: "POST",
        body: JSON.stringify({
          name: "E2E测试医生",
          hospitalId,
          department: "内科",
        }),
      });
      doctorId = doctor.id;
    });

    test("DELETE /api/hospitals/:id with referenced doctors returns 409", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/hospitals/${hospitalId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("医生");
    });

    test("cleanup: delete doctor then hospital", async () => {
      await apiRequest<{ success: boolean }>(`/api/doctors/${doctorId}`, {
        method: "DELETE",
      });
      const { status } = await apiRequest<{ success: boolean }>(
        `/api/hospitals/${hospitalId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
    });
  });
});
