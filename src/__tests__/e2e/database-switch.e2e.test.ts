import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface SwitchResponse {
  success?: boolean;
  database?: string;
  error?: string;
}

describe("Database Switch API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("GET /api/database/switch", () => {
    test("returns current database", async () => {
      const { status, data } = await apiRequest<SwitchResponse>(
        "/api/database/switch",
      );

      expect(status).toBe(200);
      expect(data.database).toBeDefined();
    });
  });

  describe("POST /api/database/switch", () => {
    test("rejects invalid database type", async () => {
      const { status, data } = await apiRequest<SwitchResponse>(
        "/api/database/switch",
        {
          method: "POST",
          body: JSON.stringify({ database: "invalid" }),
        },
      );

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid target database");
    });

    test("E2E mode locks database to test", async () => {
      // E2E runner sets E2E_SKIP_AUTH=true and SURETY_TARGET_DB=test
      // Attempting to switch to production should be rejected
      const { status, data } = await apiRequest<SwitchResponse>(
        "/api/database/switch",
        {
          method: "POST",
          body: JSON.stringify({ database: "production" }),
        },
      );

      expect(status).toBe(403);
      expect(data.error).toContain("locked");
    });

    test("E2E mode allows switching to dev", async () => {
      const { status, data } = await apiRequest<SwitchResponse>(
        "/api/database/switch",
        {
          method: "POST",
          body: JSON.stringify({ database: "dev" }),
        },
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.database).toBe("dev");
    });
  });
});
