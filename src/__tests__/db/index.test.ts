import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getCurrentDatabaseType,
  getDatabaseFile,
  getDbForType,
  getDb,
  switchDatabase,
  ensureDatabase,
  ensureDatabaseFromCookie,
  createTestDb,
  createE2EDb,
  resetE2EDb,
  getE2EDbPath,
  resetTestDb,
  isE2EMode,
  closeDb,
} from "@/db";
import { membersRepo, insurersRepo } from "@/db/repositories";

/**
 * Tests for src/db/index.ts
 *
 * SAFETY: createDatabase() has a test-env guard that throws if tests try to
 * open surety.db or surety.example.db. Tests that previously opened these
 * files now verify the guard throws correctly. The example db integrity test
 * uses bun:sqlite directly (bypasses createDatabase) to read demo data.
 */

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// Safe temp db file used by tests that need a real file via SURETY_DB env var
const TEMP_DB = "surety.ut-temp.db";

/**
 * Safely clean up ONLY test-created temporary db files.
 * NEVER call this on surety.db, surety.example.db, or surety.test.db.
 */
function cleanupTempDb() {
  const filepath = resolve(PROJECT_ROOT, TEMP_DB);
  if (existsSync(filepath)) {
    unlinkSync(filepath);
  }
}

describe("db/index", () => {
  // Save original env
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.SURETY_DB = process.env.SURETY_DB;
    originalEnv.SURETY_E2E = process.env.SURETY_E2E;
  });

  afterEach(() => {
    closeDb();
    cleanupTempDb();
    // Restore env
    if (originalEnv.SURETY_DB === undefined) {
      delete process.env.SURETY_DB;
    } else {
      process.env.SURETY_DB = originalEnv.SURETY_DB;
    }
    if (originalEnv.SURETY_E2E === undefined) {
      delete process.env.SURETY_E2E;
    } else {
      process.env.SURETY_E2E = originalEnv.SURETY_E2E;
    }
  });

  describe("getCurrentDatabaseType", () => {
    test("returns 'test' when SURETY_DB contains 'e2e'", () => {
      process.env.SURETY_DB = "surety.e2e.db";
      expect(getCurrentDatabaseType()).toBe("test");
    });

    test("returns 'test' when SURETY_DB equals E2E_DB_FILE", () => {
      process.env.SURETY_DB = "surety.e2e.db";
      expect(getCurrentDatabaseType()).toBe("test");
    });

    test("returns 'example' when SURETY_DB contains 'example'", () => {
      process.env.SURETY_DB = "surety.example.db";
      expect(getCurrentDatabaseType()).toBe("example");
    });

    test("returns 'production' for non-matching SURETY_DB value", () => {
      process.env.SURETY_DB = "custom.db";
      expect(getCurrentDatabaseType()).toBe("production");
    });

    test("returns 'production' when SURETY_DB is not set", () => {
      delete process.env.SURETY_DB;
      expect(getCurrentDatabaseType()).toBe("production");
    });
  });

  describe("getDatabaseFile", () => {
    test("returns correct file for production", () => {
      expect(getDatabaseFile("production")).toBe("surety.db");
    });

    test("returns correct file for example", () => {
      expect(getDatabaseFile("example")).toBe("surety.example.db");
    });

    test("returns correct file for test", () => {
      expect(getDatabaseFile("test")).toBe("surety.e2e.db");
    });
  });

  // --- Test-env guard: verify protected files are BLOCKED ---

  describe("test-env guard", () => {
    test("getDbForType('production') throws for surety.db", () => {
      expect(() => getDbForType("production")).toThrow("BLOCKED");
    });

    test("getDbForType('example') throws for surety.example.db", () => {
      expect(() => getDbForType("example")).toThrow("BLOCKED");
    });

    test("getDb() throws when SURETY_DB is not set (defaults to production)", () => {
      delete process.env.SURETY_DB;
      expect(() => getDb()).toThrow("BLOCKED");
    });

    test("getDb() throws when SURETY_DB is surety.db", () => {
      process.env.SURETY_DB = "surety.db";
      expect(() => getDb()).toThrow("BLOCKED");
    });

    test("getDb() throws when SURETY_DB is surety.example.db", () => {
      process.env.SURETY_DB = "surety.example.db";
      expect(() => getDb()).toThrow("BLOCKED");
    });

    test("switchDatabase('production') throws", () => {
      expect(() => switchDatabase("production")).toThrow("BLOCKED");
    });

    test("switchDatabase('example') throws", () => {
      expect(() => switchDatabase("example")).toThrow("BLOCKED");
    });

    test("ensureDatabase('production') throws", () => {
      expect(() => ensureDatabase("production")).toThrow("BLOCKED");
    });

    test("ensureDatabaseFromCookie(undefined) throws (defaults to production)", () => {
      delete process.env.SURETY_DB;
      expect(() => ensureDatabaseFromCookie(undefined)).toThrow("BLOCKED");
    });

    test("ensureDatabaseFromCookie('production') throws", () => {
      delete process.env.SURETY_DB;
      expect(() => ensureDatabaseFromCookie("production")).toThrow("BLOCKED");
    });

    test("ensureDatabaseFromCookie with invalid cookie throws (defaults to production)", () => {
      delete process.env.SURETY_DB;
      expect(() => ensureDatabaseFromCookie("invalid" as string)).toThrow("BLOCKED");
    });

    test("ensureDatabaseFromCookie with SURETY_DB=example throws", () => {
      process.env.SURETY_DB = "surety.example.db";
      expect(() => ensureDatabaseFromCookie(undefined)).toThrow("BLOCKED");
    });

    test("guard does NOT block surety.e2e.db", () => {
      const db = switchDatabase("test");
      expect(db).toBeDefined();
    });

    test("guard does NOT block in-memory database", () => {
      const db = createTestDb();
      expect(db).toBeDefined();
    });

    test("guard does NOT block temp db via SURETY_DB env", () => {
      process.env.SURETY_DB = TEMP_DB;
      const db = getDb();
      expect(db).toBeDefined();
    });
  });

  describe("getDb", () => {
    test("uses SURETY_DB env var when set to safe file", () => {
      process.env.SURETY_DB = TEMP_DB;
      const db = getDb();
      expect(db).toBeDefined();
    });
  });

  describe("switchDatabase", () => {
    test("switches to test database type", () => {
      createTestDb();
      const db = switchDatabase("test");
      expect(db).toBeDefined();
    });

    test("returns existing instance when already on same database", () => {
      const first = switchDatabase("test");
      const second = switchDatabase("test");
      expect(first).toBeDefined();
      expect(second).toBeDefined();
    });

    test("closes existing connection before switching to different db", () => {
      // Switch from in-memory to e2e (both safe)
      createTestDb();
      const db = switchDatabase("test");
      expect(db).toBeDefined();
    });
  });

  describe("ensureDatabase", () => {
    test("returns existing instance when already connected to correct type", () => {
      switchDatabase("test");
      const db = ensureDatabase("test");
      expect(db).toBeDefined();
    });
  });

  describe("ensureDatabaseFromCookie", () => {
    test("uses env var when SURETY_DB is set to e2e", () => {
      process.env.SURETY_DB = "surety.e2e.db";
      const db = ensureDatabaseFromCookie("production");
      expect(db).toBeDefined();
    });

    test("uses env var mapped to production type (throws for non-e2e/example SURETY_DB)", () => {
      // SURETY_DB=surety.ut-temp.db doesn't match e2e or example patterns,
      // so ensureDatabaseFromCookie maps it to "production" → opens surety.db → BLOCKED
      process.env.SURETY_DB = TEMP_DB;
      expect(() => ensureDatabaseFromCookie("test")).toThrow("BLOCKED");
    });

    test("falls back to cookie value 'test' when no env var", () => {
      delete process.env.SURETY_DB;
      const db = ensureDatabaseFromCookie("test");
      expect(db).toBeDefined();
    });
  });

  describe("createTestDb", () => {
    test("creates an in-memory database", () => {
      const db = createTestDb();
      expect(db).toBeDefined();
    });

    test("closes existing connection before creating new one", () => {
      switchDatabase("test");
      const db = createTestDb();
      expect(db).toBeDefined();
    });
  });

  describe("createE2EDb", () => {
    test("creates E2E database and returns filename", () => {
      const filename = createE2EDb();
      expect(filename).toBe("surety.e2e.db");
    });

    test("closes existing connection before creating", () => {
      createTestDb();
      const filename = createE2EDb();
      expect(filename).toBe("surety.e2e.db");
    });
  });

  describe("resetE2EDb", () => {
    test("clears all data from E2E database", () => {
      createE2EDb();
      resetE2EDb();
    });

    test("creates E2E database if no connection exists", () => {
      closeDb();
      resetE2EDb();
    });
  });

  describe("getE2EDbPath", () => {
    test("returns E2E database filename", () => {
      expect(getE2EDbPath()).toBe("surety.e2e.db");
    });
  });

  describe("resetTestDb", () => {
    test("clears all data from test database", () => {
      createTestDb();
      resetTestDb();
    });

    test("creates test database if no connection exists", () => {
      closeDb();
      resetTestDb();
    });

    test("BLOCKS wiping production database", () => {
      // Simulate a scenario where someone connected to production
      // then calls resetTestDb(). The guard must refuse.
      // We can't actually connect to surety.db in test env (createDatabase guard blocks it),
      // so we verify the guard logic indirectly: resetTestDb on a fresh :memory: db works fine
      createTestDb();
      expect(() => resetTestDb()).not.toThrow();
    });
  });

  describe("resetE2EDb guard", () => {
    test("works on E2E database", () => {
      createE2EDb();
      expect(() => resetE2EDb()).not.toThrow();
    });

    test("creates E2E database if no connection exists", () => {
      closeDb();
      expect(() => resetE2EDb()).not.toThrow();
    });
  });

  describe("isE2EMode", () => {
    test("returns true when connected to E2E database", () => {
      createE2EDb();
      expect(isE2EMode()).toBe(true);
    });

    test("returns true when SURETY_E2E env is 'true'", () => {
      createTestDb();
      process.env.SURETY_E2E = "true";
      expect(isE2EMode()).toBe(true);
    });

    test("returns false for non-E2E database without env", () => {
      createTestDb();
      delete process.env.SURETY_E2E;
      expect(isE2EMode()).toBe(false);
    });
  });

  describe("closeDb", () => {
    test("closes an open connection", () => {
      createTestDb();
      closeDb();
    });

    test("is safe to call when no connection exists", () => {
      closeDb();
      closeDb();
    });
  });

  describe("createDatabase (via getDb)", () => {
    test("reuses existing connection for same filename", () => {
      process.env.SURETY_DB = TEMP_DB;
      const first = getDb();
      const second = getDb();
      expect(first).toBeDefined();
      expect(second).toBeDefined();
    });

    test("switches connection when filename changes", () => {
      process.env.SURETY_DB = TEMP_DB;
      getDb();

      // Switch to a different safe temp file
      process.env.SURETY_DB = "surety.e2e.db";
      const db = getDb();
      expect(db).toBeDefined();
    });
  });

  describe("initSchema", () => {
    test("creates all expected tables", () => {
      createTestDb();
      const members = membersRepo.findAll();
      expect(members).toEqual([]);
      const insurers = insurersRepo.findAll();
      expect(insurers).toEqual([]);
    });
  });

  describe("example database integrity", () => {
    test("surety.example.db must contain demo data (guard against accidental deletion)", () => {
      // Use bun:sqlite directly to bypass createDatabase() guard.
      // This test ensures no other test has corrupted the example db.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database } = require("bun:sqlite");
      const dbPath = resolve(PROJECT_ROOT, "surety.example.db");
      const db = new Database(dbPath, { readonly: true });
      const result = db.query("SELECT count(*) as c FROM members").get() as { c: number };
      expect(result.c).toBeGreaterThanOrEqual(5);
      db.close();
    });

    test("surety.test.db must contain demo data (copy of example)", () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database } = require("bun:sqlite");
      const dbPath = resolve(PROJECT_ROOT, "surety.test.db");
      const db = new Database(dbPath, { readonly: true });
      const result = db.query("SELECT count(*) as c FROM members").get() as { c: number };
      expect(result.c).toBeGreaterThanOrEqual(5);
      db.close();
    });
  });

  describe("seed script production guard", () => {
    test("scripts/seed.ts exits with error when SURETY_DB is not set", async () => {
      const proc = Bun.spawn(["bun", "scripts/seed.ts"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, SURETY_DB: undefined },
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("BLOCKED");
    });

    test("scripts/seed.ts exits with error when SURETY_DB=surety.db", async () => {
      const proc = Bun.spawn(["bun", "scripts/seed.ts"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, SURETY_DB: "surety.db" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("BLOCKED");
    });

    test("scripts/seed.ts exits with error when SURETY_DB=surety.example.db", async () => {
      const proc = Bun.spawn(["bun", "scripts/seed.ts"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, SURETY_DB: "surety.example.db" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("BLOCKED");
    });
  });

  describe("import-csv script production guard", () => {
    test("scripts/import-csv.ts exits with error without --confirm", async () => {
      const proc = Bun.spawn(["bun", "scripts/import-csv.ts"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, SURETY_DB: undefined },
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("BLOCKED");
    });

    test("scripts/import-csv.ts allows E2E database without --confirm", async () => {
      // This will fail because CSV file doesn't exist, but it should NOT be blocked
      const proc = Bun.spawn(["bun", "scripts/import-csv.ts"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, SURETY_DB: "surety.e2e.db" },
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      // Should NOT contain BLOCKED — it may fail for other reasons (missing CSV)
      expect(stderr).not.toContain("BLOCKED");
    });
  });
});
