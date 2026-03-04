import { describe, expect, test, beforeEach, mock } from "bun:test";
import { resetTestDb } from "@/db";
import { settingsRepo } from "@/db/repositories";
import {
  maskApiKey,
  getEnvironment,
  readBackySettings,
  writeBackySettings,
  fetchBackyHistory,
  pushBackupToBacky,
  type BackyCredentials,
  type BackyHistoryResponse,
} from "@/services/backy";

// ── maskApiKey ──

describe("maskApiKey", () => {
  test("returns empty string for empty input", () => {
    expect(maskApiKey("")).toBe("");
  });

  test("masks all but last 4 chars", () => {
    expect(maskApiKey("abcdefgh")).toBe("****efgh");
  });

  test("handles short keys (< 4 chars)", () => {
    expect(maskApiKey("abc")).toBe("abc");
  });

  test("handles exactly 4 chars", () => {
    expect(maskApiKey("abcd")).toBe("abcd");
  });

  test("masks long keys", () => {
    const key = "PFS9LfWpnNqkQF4oQI9D2YLDDOmglhBRr6Hex6J_9oXAgXTU";
    const masked = maskApiKey(key);
    expect(masked.endsWith("gXTU")).toBe(true);
    expect(masked.length).toBe(key.length);
    expect(masked.startsWith("*")).toBe(true);
  });
});

// ── getEnvironment ──

describe("getEnvironment", () => {
  test("returns 'dev' in test environment", () => {
    expect(getEnvironment()).toBe("dev");
  });
});

// ── readBackySettings / writeBackySettings ──

describe("readBackySettings", () => {
  beforeEach(() => {
    resetTestDb();
  });

  test("returns empty strings when no settings exist", () => {
    const creds = readBackySettings();
    expect(creds.webhookUrl).toBe("");
    expect(creds.apiKey).toBe("");
  });

  test("returns stored values", () => {
    settingsRepo.set("backy.webhookUrl", "https://backy.example.com/webhook/123");
    settingsRepo.set("backy.apiKey", "test-key-abc");

    const creds = readBackySettings();
    expect(creds.webhookUrl).toBe("https://backy.example.com/webhook/123");
    expect(creds.apiKey).toBe("test-key-abc");
  });
});

describe("writeBackySettings", () => {
  beforeEach(() => {
    resetTestDb();
  });

  test("persists webhook URL and API key", () => {
    writeBackySettings({
      webhookUrl: "https://backy.example.com/webhook/456",
      apiKey: "my-secret-key",
    });

    expect(settingsRepo.get("backy.webhookUrl")).toBe("https://backy.example.com/webhook/456");
    expect(settingsRepo.get("backy.apiKey")).toBe("my-secret-key");
  });

  test("overwrites existing settings", () => {
    writeBackySettings({ webhookUrl: "https://old.com", apiKey: "old-key" });
    writeBackySettings({ webhookUrl: "https://new.com", apiKey: "new-key" });

    expect(settingsRepo.get("backy.webhookUrl")).toBe("https://new.com");
    expect(settingsRepo.get("backy.apiKey")).toBe("new-key");
  });
});

// ── fetchBackyHistory ──

describe("fetchBackyHistory", () => {
  const creds: BackyCredentials = {
    webhookUrl: "https://backy.example.com/api/webhook/test123",
    apiKey: "test-key",
  };

  test("returns data on success", async () => {
    const mockData: BackyHistoryResponse = {
      project_name: "surety",
      environment: null,
      total_backups: 3,
      recent_backups: [
        { id: "1", tag: "v1.0.0-2026-02-23-7mem-8pol-3ast-5ins", environment: "dev", file_size: 1024, is_single_json: 1, created_at: "2026-02-23T10:00:00Z" },
      ],
    };

    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 })),
    );

    try {
      const result = await fetchBackyHistory(creds);
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data?.total_backups).toBe(3);
      expect(result.data?.recent_backups).toHaveLength(1);
      expect(result.error).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("returns error on HTTP failure", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Unauthorized", { status: 401 })),
    );

    try {
      const result = await fetchBackyHistory(creds);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(401);
      expect(result.data).toBeNull();
      expect(result.error).toBe("Unauthorized");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("returns error on network failure", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.reject(new Error("DNS resolution failed")));

    try {
      const result = await fetchBackyHistory(creds);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
      expect(result.data).toBeNull();
      expect(result.error).toBe("DNS resolution failed");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("handles non-Error throw", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.reject("string error"));

    try {
      const result = await fetchBackyHistory(creds);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("string error");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("handles empty response body on HTTP error", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 500 })),
    );

    try {
      const result = await fetchBackyHistory(creds);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error).toBe("HTTP 500");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("handles empty history", async () => {
    const mockData: BackyHistoryResponse = {
      project_name: "surety",
      environment: null,
      total_backups: 0,
      recent_backups: [],
    };

    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 })),
    );

    try {
      const result = await fetchBackyHistory(creds);
      expect(result.ok).toBe(true);
      expect(result.data?.total_backups).toBe(0);
      expect(result.data?.recent_backups).toHaveLength(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ── pushBackupToBacky ──

describe("pushBackupToBacky", () => {
  const creds: BackyCredentials = {
    webhookUrl: "https://backy.example.com/api/webhook/test123",
    apiKey: "test-key",
  };

  beforeEach(() => {
    resetTestDb();
  });

  test("returns success on 200 response", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ id: "backup-1" }), { status: 200 })),
    );

    try {
      const result = await pushBackupToBacky(creds);
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.request.method).toBe("POST");
      expect(result.request.url).toBe(creds.webhookUrl);
      expect(result.request.environment).toBe("dev");
      expect(result.request.tag).toContain("v");
      expect(result.request.fileName).toMatch(/^surety-backup-\d{4}-\d{2}-\d{2}\.json$/);
      expect(result.request.fileSizeBytes).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("includes backup stats in request metadata", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );

    try {
      const result = await pushBackupToBacky(creds);
      expect(result.request.backupStats).toBeDefined();
      expect(typeof result.request.backupStats.members).toBe("number");
      expect(typeof result.request.backupStats.policies).toBe("number");
      expect(typeof result.request.backupStats.settings).toBe("number");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("returns failure on HTTP error", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Bad Request", { status: 400 })),
    );

    try {
      const result = await pushBackupToBacky(creds);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("returns failure on network error", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.reject(new Error("Connection refused")));

    try {
      const result = await pushBackupToBacky(creds);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
      expect(result.body).toEqual({ fetchError: "Connection refused" });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("handles non-JSON response body", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("not json", { status: 200 })),
    );

    try {
      const result = await pushBackupToBacky(creds);
      expect(result.ok).toBe(true);
      expect(result.body).toBe("not json");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("sends correct Authorization header", async () => {
    const origFetch = globalThis.fetch;
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    try {
      await pushBackupToBacky(creds);
      expect(capturedHeaders?.get("Authorization")).toBe("Bearer test-key");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
