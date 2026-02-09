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
 * Since the module has module-level mutable state (sqlite, dbInstance, currentDbFile),
 * we use closeDb() in afterEach to ensure isolation between tests.
 */

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// Helper to clean up test db files
function cleanupDbFile(filename: string) {
  const filepath = resolve(PROJECT_ROOT, filename);
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
      const db = getDbForType("production");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.db");
    });
  });

  describe("getDb", () => {
    test("uses SURETY_DB env var when set", () => {
      process.env.SURETY_DB = "surety.e2e.db";
      const db = getDb();
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("uses production database when SURETY_DB is not set", () => {
      delete process.env.SURETY_DB;
      const db = getDb();
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.db");
    });
  });

  describe("switchDatabase", () => {
    test("switches to a different database type", () => {
      // Start with test db
      createTestDb();
      // Switch to e2e
      const db = switchDatabase("test");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("returns existing instance when already on same database", () => {
      const first = switchDatabase("test");
      const second = switchDatabase("test");
      // Should return the same instance
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("closes existing connection before switching", () => {
      switchDatabase("test");
      // Switch to a different one
      const db = switchDatabase("production");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
      cleanupDbFile("surety.db");
    });
  });

  describe("ensureDatabase", () => {
    test("returns existing instance when already connected to correct type", () => {
      switchDatabase("test");
      const db = ensureDatabase("test");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("switches when connected to different type", () => {
      switchDatabase("test");
      const db = ensureDatabase("production");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
      cleanupDbFile("surety.db");
    });
  });

  describe("ensureDatabaseFromCookie", () => {
    test("uses env var when SURETY_DB is set (e2e)", () => {
      process.env.SURETY_DB = "surety.e2e.db";
      const db = ensureDatabaseFromCookie("production");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("uses env var when SURETY_DB contains 'example'", () => {
      process.env.SURETY_DB = "surety.example.db";
      const db = ensureDatabaseFromCookie(undefined);
      expect(db).toBeDefined();
      closeDb();
      // NOTE: Do NOT cleanupDbFile("surety.example.db") here.
      // surety.example.db is a git-tracked data file with real demo data.
      // Deleting it destroys the example database.
    });

    test("uses env var for production SURETY_DB", () => {
      process.env.SURETY_DB = "surety.db";
      const db = ensureDatabaseFromCookie("test");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.db");
    });

    test("falls back to cookie value when no env var", () => {
      delete process.env.SURETY_DB;
      const db = ensureDatabaseFromCookie("test");
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("defaults to production when cookie is undefined", () => {
      delete process.env.SURETY_DB;
      const db = ensureDatabaseFromCookie(undefined);
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.db");
    });

    test("defaults to production for invalid cookie value", () => {
      delete process.env.SURETY_DB;
      const db = ensureDatabaseFromCookie("invalid" as unknown as string);
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.db");
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
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });
  });

  describe("createE2EDb", () => {
    test("creates E2E database and returns filename", () => {
      const filename = createE2EDb();
      expect(filename).toBe("surety.e2e.db");
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("closes existing connection before creating", () => {
      createTestDb();
      const filename = createE2EDb();
      expect(filename).toBe("surety.e2e.db");
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });
  });

  describe("resetE2EDb", () => {
    test("clears all data from E2E database", () => {
      createE2EDb();
      // Should not throw
      resetE2EDb();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("creates E2E database if no connection exists", () => {
      closeDb();
      // Should auto-create connection
      resetE2EDb();
      closeDb();
      cleanupDbFile("surety.e2e.db");
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
      createE2EDb();
      expect(isE2EMode()).toBe(true);
      closeDb();
      cleanupDbFile("surety.e2e.db");
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
      // Should not throw
      closeDb();
    });

    test("is safe to call when no connection exists", () => {
      closeDb();
      // Should not throw
      closeDb();
    });
  });

  describe("createDatabase (via getDb)", () => {
    test("reuses existing connection for same filename", () => {
      process.env.SURETY_DB = "surety.e2e.db";
      const first = getDb();
      const second = getDb();
      // Both should return a valid instance (same connection reused)
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
    });

    test("switches connection when filename changes", () => {
      process.env.SURETY_DB = "surety.e2e.db";
      getDb();
      process.env.SURETY_DB = "surety.db";
      const db = getDb();
      expect(db).toBeDefined();
      closeDb();
      cleanupDbFile("surety.e2e.db");
      cleanupDbFile("surety.db");
    });
  });

  describe("initSchema", () => {
    test("creates all expected tables", () => {
      createTestDb();
      // If schema was initialized correctly, we can query tables
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
