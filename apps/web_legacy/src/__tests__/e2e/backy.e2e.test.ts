import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface BackySettingsResponse {
  webhookUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  environment: "prod" | "dev";
}

/**
 * Clean up backy settings before tests
 */
async function cleanupBackySettings(): Promise<void> {
  await apiRequest("/api/settings/backy.webhookUrl", { method: "DELETE" }).catch(() => {});
  await apiRequest("/api/settings/backy.apiKey", { method: "DELETE" }).catch(() => {});
}

describe("Backy API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
    // Clean up any existing backy settings from previous test runs
    await cleanupBackySettings();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("GET /api/settings/backy", () => {
    test("returns empty config when not configured", async () => {
      const { status, data } = await apiRequest<BackySettingsResponse>(
        "/api/settings/backy",
      );

      expect(status).toBe(200);
      expect(data.webhookUrl).toBe("");
      expect(data.apiKey).toBe("");
      expect(data.hasApiKey).toBe(false);
      expect(data.environment).toBe("dev");
    });
  });

  describe("PUT /api/settings/backy", () => {
    test("saves webhook URL and API key", async () => {
      const { status, data } = await apiRequest<BackySettingsResponse>(
        "/api/settings/backy",
        {
          method: "PUT",
          body: JSON.stringify({
            webhookUrl: "https://backy.example.com/webhook/test",
            apiKey: "test-api-key-1234",
          }),
        },
      );

      expect(status).toBe(200);
      expect(data.webhookUrl).toBe("https://backy.example.com/webhook/test");
      expect(data.hasApiKey).toBe(true);
      // API key should be masked
      expect(data.apiKey).toContain("*");
      expect(data.apiKey.endsWith("1234")).toBe(true);
    });

    test("returns 400 when webhookUrl is missing", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/settings/backy",
        {
          method: "PUT",
          body: JSON.stringify({ apiKey: "some-key" }),
        },
      );

      expect(status).toBe(400);
      expect(data.error).toContain("webhookUrl");
    });

    test("returns 400 when apiKey is missing", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/settings/backy",
        {
          method: "PUT",
          body: JSON.stringify({ webhookUrl: "https://example.com" }),
        },
      );

      expect(status).toBe(400);
      expect(data.error).toContain("apiKey");
    });
  });

  describe("POST /api/settings/backy/test", () => {
    test("returns 400 when not configured", async () => {
      // First clear settings
      await apiRequest("/api/settings/backy.webhookUrl", { method: "DELETE" });
      await apiRequest("/api/settings/backy.apiKey", { method: "DELETE" });

      const { status, data } = await apiRequest<{ error: string }>(
        "/api/settings/backy/test",
        { method: "POST" },
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("POST /api/settings/backy/push", () => {
    test("returns 400 when not configured", async () => {
      // Ensure settings are cleared
      await apiRequest("/api/settings/backy.webhookUrl", { method: "DELETE" });
      await apiRequest("/api/settings/backy.apiKey", { method: "DELETE" });

      const { status, data } = await apiRequest<{ error: string }>(
        "/api/settings/backy/push",
        { method: "POST" },
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("GET /api/settings/backy/history", () => {
    test("returns 400 when not configured", async () => {
      // Ensure settings are cleared
      await apiRequest("/api/settings/backy.webhookUrl", { method: "DELETE" });
      await apiRequest("/api/settings/backy.apiKey", { method: "DELETE" });

      const { status, data } = await apiRequest<{ error: string }>(
        "/api/settings/backy/history",
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("GET /api/settings/backy after PUT", () => {
    test("reflects saved configuration", async () => {
      // Save config
      await apiRequest("/api/settings/backy", {
        method: "PUT",
        body: JSON.stringify({
          webhookUrl: "https://backy.example.com/webhook/verify",
          apiKey: "verify-key-abcd",
        }),
      });

      // Read back
      const { status, data } = await apiRequest<BackySettingsResponse>(
        "/api/settings/backy",
      );

      expect(status).toBe(200);
      expect(data.webhookUrl).toBe("https://backy.example.com/webhook/verify");
      expect(data.hasApiKey).toBe(true);
      expect(data.apiKey.endsWith("abcd")).toBe(true);
    });
  });
});
