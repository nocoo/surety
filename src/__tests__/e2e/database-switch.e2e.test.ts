import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface DatabaseSwitchResponse {
  success?: boolean;
  database: string;
  file: string;
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
    test("returns current database info", async () => {
      const { status, data } = await apiRequest<DatabaseSwitchResponse>(
        "/api/database/switch"
      );

      expect(status).toBe(200);
      expect(data.database).toBeDefined();
      expect(data.file).toBeDefined();
      expect(typeof data.database).toBe("string");
      expect(typeof data.file).toBe("string");
    });

    test("database is one of valid types", async () => {
      const { data } = await apiRequest<DatabaseSwitchResponse>(
        "/api/database/switch"
      );

      expect(["production", "example", "test"]).toContain(data.database);
    });

    test("file matches database type", async () => {
      const { data } = await apiRequest<DatabaseSwitchResponse>(
        "/api/database/switch"
      );

      const expectedFiles: Record<string, string> = {
        production: "surety.db",
        example: "surety.example.db",
        test: "surety.e2e.db",
      };

      expect(data.file).toBe(expectedFiles[data.database] ?? "");
    });
  });

  describe("POST /api/database/switch", () => {
    test("rejects invalid database type", async () => {
      const { status, data } = await apiRequest<DatabaseSwitchResponse>(
        "/api/database/switch",
        {
          method: "POST",
          body: JSON.stringify({ database: "invalid" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid database type");
    });

    test("accepts valid database types", async () => {
      // Note: In E2E environment, SURETY_DB env var takes precedence
      // So this test just verifies the API accepts valid inputs
      const validTypes = ["production", "example", "test"];

      for (const dbType of validTypes) {
        const { status, data } = await apiRequest<DatabaseSwitchResponse>(
          "/api/database/switch",
          {
            method: "POST",
            body: JSON.stringify({ database: dbType }),
          }
        );

        expect(status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.database).toBe(dbType);
      }
    });

    test("returns correct file for each database type", async () => {
      const dbFiles: Array<{ type: string; file: string }> = [
        { type: "production", file: "surety.db" },
        { type: "example", file: "surety.example.db" },
        { type: "test", file: "surety.e2e.db" },
      ];

      for (const { type, file } of dbFiles) {
        const { data } = await apiRequest<DatabaseSwitchResponse>(
          "/api/database/switch",
          {
            method: "POST",
            body: JSON.stringify({ database: type }),
          }
        );

        expect(data.file).toBe(file);
      }
    });
  });
});
