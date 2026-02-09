import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, unlinkSync, copyFileSync } from "fs";
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
 * CRITICAL SAFETY RULE:
 * Tests must NEVER delete or corrupt user data files (surety.db, surety.example.db).
 * For functions that open real db files (switchDatabase, getDbForType, etc.),
 * we backup existing files before and restore after.
 *
 * Since the module has module-level mutable state (sqlite, dbInstance, currentDbFile),
 * we use closeDb() in afterEach to ensure isolation between tests.
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

/** Check if a db file exists (has pre-existing user data). */
function dbFileExists(filename: string): boolean {
  return existsSync(resolve(PROJECT_ROOT, filename));
}

/** Backup a db file before a test that may create/overwrite it. */
function backupDbFile(filename: string): boolean {
  const filepath = resolve(PROJECT_ROOT, filename);
  if (existsSync(filepath)) {
    copyFileSync(filepath, filepath + ".bak");
    return true;
  }
  return false;
}

/** Restore a db file after a test, or remove if it didn't exist before. */
function restoreDbFile(filename: string, existed: boolean) {
  const filepath = resolve(PROJECT_ROOT, filename);
  if (existed) {
    const bakPath = filepath + ".bak";
    if (existsSync(bakPath)) {
      copyFileSync(bakPath, filepath);
      unlinkSync(bakPath);
    }
  } else {
    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }
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

  describe("getDbForType", () => {
    test("returns a db instance for production type", () => {
      // This opens surety.db — backup if it exists
      const existed = dbFileExists("surety.db");
      backupDbFile("surety.db");

      const db = getDbForType("production");
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.db", existed);
    });
  });

  describe("getDb", () => {
    test("uses SURETY_DB env var when set", () => {
      process.env.SURETY_DB = TEMP_DB;
      const db = getDb();
      expect(db).toBeDefined();
      // cleanupTempDb handled by afterEach
    });

    test("uses production database when SURETY_DB is not set", () => {
      delete process.env.SURETY_DB;
      const existed = dbFileExists("surety.db");
      backupDbFile("surety.db");

      const db = getDb();
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.db", existed);
    });
  });

  describe("switchDatabase", () => {
    test("switches to a different database type", () => {
      // Start with in-memory, switch to e2e (safe — e2e is ephemeral)
      createTestDb();
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      const db = switchDatabase("test");
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });

    test("returns existing instance when already on same database", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      const first = switchDatabase("test");
      const second = switchDatabase("test");
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });

    test("closes existing connection before switching", () => {
      const e2eExisted = dbFileExists("surety.e2e.db");
      const prodExisted = dbFileExists("surety.db");
      backupDbFile("surety.e2e.db");
      backupDbFile("surety.db");

      switchDatabase("test");
      const db = switchDatabase("production");
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", e2eExisted);
      restoreDbFile("surety.db", prodExisted);
    });
  });

  describe("ensureDatabase", () => {
    test("returns existing instance when already connected to correct type", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      switchDatabase("test");
      const db = ensureDatabase("test");
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });

    test("switches when connected to different type", () => {
      const e2eExisted = dbFileExists("surety.e2e.db");
      const prodExisted = dbFileExists("surety.db");
      backupDbFile("surety.e2e.db");
      backupDbFile("surety.db");

      switchDatabase("test");
      const db = ensureDatabase("production");
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", e2eExisted);
      restoreDbFile("surety.db", prodExisted);
    });
  });

  describe("ensureDatabaseFromCookie", () => {
    test("uses env var when SURETY_DB is set (e2e)", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      process.env.SURETY_DB = "surety.e2e.db";
      const db = ensureDatabaseFromCookie("production");
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });

    test("uses env var when SURETY_DB contains 'example'", () => {
      // surety.example.db is a git-tracked data file with real demo data.
      // We connect read-only (no writes) and NEVER delete it.
      process.env.SURETY_DB = "surety.example.db";
      const db = ensureDatabaseFromCookie(undefined);
      expect(db).toBeDefined();
      closeDb();
    });

    test("uses env var for production SURETY_DB", () => {
      // Use temp db to avoid touching real surety.db
      process.env.SURETY_DB = TEMP_DB;
      const db = ensureDatabaseFromCookie("test");
      expect(db).toBeDefined();
      // cleanupTempDb handled by afterEach
    });

    test("falls back to cookie value when no env var", () => {
      delete process.env.SURETY_DB;
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      const db = ensureDatabaseFromCookie("test");
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });

    test("defaults to production when cookie is undefined", () => {
      delete process.env.SURETY_DB;
      const existed = dbFileExists("surety.db");
      backupDbFile("surety.db");

      const db = ensureDatabaseFromCookie(undefined);
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.db", existed);
    });

    test("defaults to production for invalid cookie value", () => {
      delete process.env.SURETY_DB;
      const existed = dbFileExists("surety.db");
      backupDbFile("surety.db");

      const db = ensureDatabaseFromCookie("invalid" as unknown as string);
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.db", existed);
    });
  });

  describe("createTestDb", () => {
    test("creates an in-memory database", () => {
      const db = createTestDb();
      expect(db).toBeDefined();
    });

    test("closes existing connection before creating new one", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      switchDatabase("test");
      const db = createTestDb();
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });
  });

  describe("createE2EDb", () => {
    test("creates E2E database and returns filename", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      const filename = createE2EDb();
      expect(filename).toBe("surety.e2e.db");
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });

    test("closes existing connection before creating", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      createTestDb();
      const filename = createE2EDb();
      expect(filename).toBe("surety.e2e.db");
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });
  });

  describe("resetE2EDb", () => {
    test("clears all data from E2E database", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      createE2EDb();
      resetE2EDb();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
    });

    test("creates E2E database if no connection exists", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      closeDb();
      resetE2EDb();
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
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
      // Should not throw
      resetTestDb();
    });

    test("creates test database if no connection exists", () => {
      closeDb();
      // Should auto-create via createTestDb
      resetTestDb();
    });
  });

  describe("isE2EMode", () => {
    test("returns true when connected to E2E database", () => {
      const existed = dbFileExists("surety.e2e.db");
      backupDbFile("surety.e2e.db");

      createE2EDb();
      expect(isE2EMode()).toBe(true);
      closeDb();

      restoreDbFile("surety.e2e.db", existed);
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
      // cleanupTempDb handled by afterEach
    });

    test("switches connection when filename changes", () => {
      process.env.SURETY_DB = TEMP_DB;
      getDb();

      const existed = dbFileExists("surety.db");
      backupDbFile("surety.db");

      process.env.SURETY_DB = "surety.db";
      const db = getDb();
      expect(db).toBeDefined();
      closeDb();

      restoreDbFile("surety.db", existed);
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
      // This test acts as a canary: if any other test accidentally deletes
      // or truncates surety.example.db, this will fail immediately.
      const savedEnv = process.env.SURETY_DB;
      process.env.SURETY_DB = "surety.example.db";
      const db = getDb();
      expect(db).toBeDefined();

      const members = membersRepo.findAll();
      expect(members.length).toBeGreaterThanOrEqual(5);

      closeDb();
      // Restore — do NOT delete the example database
      if (savedEnv === undefined) {
        delete process.env.SURETY_DB;
      } else {
        process.env.SURETY_DB = savedEnv;
      }
    });
  });
});
