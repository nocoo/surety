import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface Setting {
  key: string;
  value: string;
}

describe("Settings API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("Seed data verification", () => {
    test("GET /api/settings returns seeded settings", async () => {
      const { status, data } = await apiRequest<Setting[]>("/api/settings");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(3); // annualIncome, emergencyFundMonths, riskTolerance
    });

    test("seeded settings include expected keys", async () => {
      const { data } = await apiRequest<Setting[]>("/api/settings");
      const keys = data.map((s) => s.key);

      expect(keys).toContain("annualIncome");
      expect(keys).toContain("emergencyFundMonths");
      expect(keys).toContain("riskTolerance");
    });
  });

  describe("CRUD operations", () => {
    const testKey = "e2e_test_setting";

    test("GET /api/settings returns list", async () => {
      const { status, data } = await apiRequest<Setting[]>("/api/settings");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/settings creates new setting", async () => {
      const { status, data } = await apiRequest<Setting>("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          key: testKey,
          value: "test_value",
        }),
      });

      expect(status).toBe(201);
      expect(data.key).toBe(testKey);
      expect(data.value).toBe("test_value");
    });

    test("GET /api/settings/:key returns single setting", async () => {
      const { status, data } = await apiRequest<Setting>(
        `/api/settings/${testKey}`
      );

      expect(status).toBe(200);
      expect(data.key).toBe(testKey);
      expect(data.value).toBe("test_value");
    });

    test("PUT /api/settings/:key updates setting", async () => {
      const { status, data } = await apiRequest<Setting>(
        `/api/settings/${testKey}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value: "updated_value",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.key).toBe(testKey);
      expect(data.value).toBe("updated_value");
    });

    test("POST /api/settings upserts existing setting", async () => {
      const { status, data } = await apiRequest<Setting>("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          key: testKey,
          value: "upserted_value",
        }),
      });

      expect(status).toBe(201);
      expect(data.value).toBe("upserted_value");
    });

    test("DELETE /api/settings/:key deletes setting", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/settings/${testKey}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus, data: getData } = await apiRequest<{ key: string; value: string | null }>(
        `/api/settings/${testKey}`
      );
      expect(getStatus).toBe(200);
      expect(getData.value).toBeNull();
    });
  });

  describe("Error handling", () => {
    test("POST /api/settings with missing key returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/settings",
        {
          method: "POST",
          body: JSON.stringify({ value: "只有值" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("POST /api/settings with missing value returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/settings",
        {
          method: "POST",
          body: JSON.stringify({ key: "only_key" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("GET /api/settings/:key with non-existent key returns 200 with null value", async () => {
      const { status, data } = await apiRequest<{ key: string; value: string | null }>(
        "/api/settings/non_existent_key_12345"
      );
      expect(status).toBe(200);
      expect(data.key).toBe("non_existent_key_12345");
      expect(data.value).toBeNull();
    });

    test("PUT /api/settings/:key with missing value returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/settings/annualIncome",
        {
          method: "PUT",
          body: JSON.stringify({}),
        }
      );
      expect(status).toBe(400);
    });

    test("DELETE /api/settings/:key with non-existent key returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/settings/non_existent_key_99999",
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });

  describe("Value types", () => {
    test("setting can store string value", async () => {
      const { status, data } = await apiRequest<Setting>("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          key: "e2e_string",
          value: "hello world",
        }),
      });

      expect(status).toBe(201);
      expect(data.value).toBe("hello world");

      // Cleanup
      await apiRequest("/api/settings/e2e_string", { method: "DELETE" });
    });

    test("setting can store number as string", async () => {
      const { status, data } = await apiRequest<Setting>("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          key: "e2e_number",
          value: 12345,
        }),
      });

      expect(status).toBe(201);
      expect(data.value).toBe("12345");

      // Cleanup
      await apiRequest("/api/settings/e2e_number", { method: "DELETE" });
    });

    test("setting can store JSON as string", async () => {
      const jsonValue = { nested: { key: "value" }, array: [1, 2, 3] };
      const { status, data } = await apiRequest<Setting>("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          key: "e2e_json",
          value: JSON.stringify(jsonValue),
        }),
      });

      expect(status).toBe(201);
      expect(JSON.parse(data.value)).toEqual(jsonValue);

      // Cleanup
      await apiRequest("/api/settings/e2e_json", { method: "DELETE" });
    });
  });
});
