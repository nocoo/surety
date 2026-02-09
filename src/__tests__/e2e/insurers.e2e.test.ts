import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface Insurer {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  policyCount?: number;
}

describe("Insurers API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("CRUD operations", () => {
    let createdInsurerId: number;

    test("GET /api/insurers returns list", async () => {
      const { status, data } = await apiRequest<Insurer[]>("/api/insurers");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/insurers creates new insurer", async () => {
      const newInsurer = {
        name: `E2E测试保险公司-${Date.now()}`,
        phone: "400-123-4567",
        website: "https://e2e-test.example.com",
      };

      const { status, data } = await apiRequest<Insurer>("/api/insurers", {
        method: "POST",
        body: JSON.stringify(newInsurer),
      });

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.name).toBe(newInsurer.name);
      expect(data.phone).toBe(newInsurer.phone);
      expect(data.website).toBe(newInsurer.website);
      createdInsurerId = data.id;
    });

    test("GET /api/insurers/:id returns single insurer", async () => {
      const { status, data } = await apiRequest<Insurer>(
        `/api/insurers/${createdInsurerId}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(createdInsurerId);
    });

    test("PUT /api/insurers/:id updates insurer", async () => {
      const { status, data } = await apiRequest<Insurer>(
        `/api/insurers/${createdInsurerId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: `E2E更新保险公司-${Date.now()}`,
            phone: "400-987-6543",
            website: "https://updated.example.com",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.phone).toBe("400-987-6543");
      expect(data.website).toBe("https://updated.example.com");
    });

    test("DELETE /api/insurers/:id deletes insurer", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/insurers/${createdInsurerId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest<Insurer>(
        `/api/insurers/${createdInsurerId}`
      );
      expect(getStatus).toBe(404);
    });
  });

  describe("Error handling", () => {
    test("POST /api/insurers with missing name returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/insurers",
        {
          method: "POST",
          body: JSON.stringify({ phone: "400-000-0000" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("name");
    });

    test("POST /api/insurers with duplicate name returns 409", async () => {
      const uniqueName = `E2E重复测试-${Date.now()}`;

      // Create first insurer
      const { data: first } = await apiRequest<Insurer>("/api/insurers", {
        method: "POST",
        body: JSON.stringify({ name: uniqueName }),
      });

      // Try to create duplicate
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/insurers",
        {
          method: "POST",
          body: JSON.stringify({ name: uniqueName }),
        }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("already exists");

      // Cleanup
      await apiRequest<{ success: boolean }>(`/api/insurers/${first.id}`, {
        method: "DELETE",
      });
    });

    test("GET /api/insurers/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/insurers/invalid"
      );
      expect(status).toBe(400);
    });

    test("GET /api/insurers/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/insurers/99999"
      );
      expect(status).toBe(404);
    });

    test("PUT /api/insurers/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/insurers/abc",
        {
          method: "PUT",
          body: JSON.stringify({ name: "测试" }),
        }
      );
      expect(status).toBe(400);
    });

    test("PUT /api/insurers/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/insurers/99999",
        {
          method: "PUT",
          body: JSON.stringify({ name: "不存在" }),
        }
      );
      expect(status).toBe(404);
    });

    test("PUT /api/insurers/:id with duplicate name returns 409", async () => {
      const name1 = `E2E冲突测试1-${Date.now()}`;
      const name2 = `E2E冲突测试2-${Date.now()}`;

      // Create two insurers
      const { data: insurer1 } = await apiRequest<Insurer>("/api/insurers", {
        method: "POST",
        body: JSON.stringify({ name: name1 }),
      });
      const { data: insurer2 } = await apiRequest<Insurer>("/api/insurers", {
        method: "POST",
        body: JSON.stringify({ name: name2 }),
      });

      // Try to update insurer2's name to insurer1's name
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/insurers/${insurer2.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: name1 }),
        }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("already exists");

      // Cleanup
      await apiRequest<{ success: boolean }>(`/api/insurers/${insurer1.id}`, {
        method: "DELETE",
      });
      await apiRequest<{ success: boolean }>(`/api/insurers/${insurer2.id}`, {
        method: "DELETE",
      });
    });

    test("DELETE /api/insurers/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/insurers/xyz",
        { method: "DELETE" }
      );
      expect(status).toBe(400);
    });

    test("DELETE /api/insurers/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/insurers/99999",
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });

  describe("Edge cases", () => {
    let edgeCaseInsurerId: number;

    test("POST /api/insurers with optional fields as null", async () => {
      const { status, data } = await apiRequest<Insurer>("/api/insurers", {
        method: "POST",
        body: JSON.stringify({
          name: `E2E可选字段测试-${Date.now()}`,
          phone: null,
          website: null,
        }),
      });

      expect(status).toBe(201);
      expect(data.phone).toBeNull();
      expect(data.website).toBeNull();
      edgeCaseInsurerId = data.id;
    });

    test("PUT /api/insurers/:id with partial update", async () => {
      const { status, data } = await apiRequest<Insurer>(
        `/api/insurers/${edgeCaseInsurerId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            phone: "400-111-2222",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.phone).toBe("400-111-2222");
    });

    test("cleanup: delete edge case insurer", async () => {
      const { status } = await apiRequest<{ success: boolean }>(
        `/api/insurers/${edgeCaseInsurerId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
    });
  });
});
