import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, getBaseUrl } from "./setup";

interface BackupData {
  version: number;
  exportedAt: string;
  data: {
    members: unknown[];
    insurers: unknown[];
    assets: unknown[];
    policies: unknown[];
    beneficiaries: unknown[];
    payments: unknown[];
    cashValues: unknown[];
    coverageItems: unknown[];
    settings: unknown[];
  };
}

const ALL_TABLE_KEYS = [
  "members",
  "insurers",
  "assets",
  "policies",
  "beneficiaries",
  "payments",
  "cashValues",
  "coverageItems",
  "settings",
] as const;

describe("Backup API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  test("GET /api/backup returns 200 with JSON body", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`);
    expect(response.status).toBe(200);

    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("application/json");
  });

  test("response has Content-Disposition header with .json filename", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`);
    const disposition = response.headers.get("content-disposition");

    expect(disposition).toBeDefined();
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("surety-backup-");
    expect(disposition).toContain(".json");
  });

  test("response body contains version and exportedAt", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`);
    const backup: BackupData = await response.json();

    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBeDefined();
    // Valid ISO date
    expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt);
  });

  test("response body contains all 9 table keys", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`);
    const backup: BackupData = await response.json();

    const keys = Object.keys(backup.data);
    for (const key of ALL_TABLE_KEYS) {
      expect(keys).toContain(key);
    }
    expect(keys.length).toBe(ALL_TABLE_KEYS.length);
  });

  test("all table values are arrays", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`);
    const backup: BackupData = await response.json();

    for (const key of ALL_TABLE_KEYS) {
      expect(Array.isArray(backup.data[key])).toBe(true);
    }
  });

  test("seeded data is present in backup", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`);
    const backup: BackupData = await response.json();

    // E2E seed data should include members, policies, and assets
    expect(backup.data.members.length).toBeGreaterThan(0);
    expect(backup.data.policies.length).toBeGreaterThan(0);
  });

  test("backup is valid re-parseable JSON", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`);
    const text = await response.text();

    // Should not throw
    const parsed = JSON.parse(text);
    expect(parsed.version).toBe(1);
    expect(parsed.data).toBeDefined();
  });

  // --- POST /api/backup (restore) ---

  test("POST /api/backup restores from a valid backup", async () => {
    // Step 1: Export current data
    const exportRes = await fetch(`${getBaseUrl()}/api/backup`);
    const backup: BackupData = await exportRes.json();

    // Step 2: Restore the same data
    const restoreRes = await fetch(`${getBaseUrl()}/api/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backup),
    });

    expect(restoreRes.status).toBe(200);
    const result = await restoreRes.json();
    expect(result.success).toBe(true);
    expect(result.restored).toBeDefined();
  });

  test("POST /api/backup rejects invalid payload", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 999, data: {} }),
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBeDefined();
  });

  test("POST /api/backup rejects non-object payload", async () => {
    const response = await fetch(`${getBaseUrl()}/api/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("not an object"),
    });

    expect(response.status).toBe(400);
  });

  test("data integrity after round-trip restore", async () => {
    // Export
    const exportRes = await fetch(`${getBaseUrl()}/api/backup`);
    const backup: BackupData = await exportRes.json();
    const originalMemberCount = backup.data.members.length;

    // Restore
    await fetch(`${getBaseUrl()}/api/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backup),
    });

    // Re-export and verify counts match
    const reExportRes = await fetch(`${getBaseUrl()}/api/backup`);
    const reBackup: BackupData = await reExportRes.json();
    expect(reBackup.data.members.length).toBe(originalMemberCount);
  });
});
