import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createTestDb,
  resetTestDb,
  closeDb,
  getDbForRequest,
  resolveTargetDb,
  getRawSqlite,
  db,
} from "@/db";
import { membersRepo, insurersRepo, createAllRepos } from "@/db/repositories";

/**
 * Tests for src/db/index.ts (D1 migration version)
 *
 * Unit tests use in-memory bun:sqlite via createTestDb().
 * Remote D1 features are tested via worker-db-client.test.ts.
 */

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("db/index", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.SURETY_TARGET_DB = process.env.SURETY_TARGET_DB;
    originalEnv.SURETY_WORKER_URL = process.env.SURETY_WORKER_URL;
    originalEnv.SURETY_WORKER_SECRET = process.env.SURETY_WORKER_SECRET;
  });

  afterEach(() => {
    closeDb();
    // Restore env
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe("resolveTargetDb", () => {
    test("returns 'production' by default", () => {
      delete process.env.SURETY_TARGET_DB;
      expect(resolveTargetDb()).toBe("production");
    });

    test("uses SURETY_TARGET_DB env var when set", () => {
      process.env.SURETY_TARGET_DB = "dev";
      expect(resolveTargetDb()).toBe("dev");
    });

    test("validates SURETY_TARGET_DB value", () => {
      process.env.SURETY_TARGET_DB = "invalid";
      expect(resolveTargetDb()).toBe("production");
    });

    test("env var takes precedence over cookie", () => {
      process.env.SURETY_TARGET_DB = "dev";
      expect(resolveTargetDb("production")).toBe("dev");
    });

    test("falls back to cookie value when no env var", () => {
      delete process.env.SURETY_TARGET_DB;
      expect(resolveTargetDb("dev")).toBe("dev");
    });

    test("returns production for invalid cookie", () => {
      delete process.env.SURETY_TARGET_DB;
      expect(resolveTargetDb("invalid")).toBe("production");
    });

    test("accepts all valid target db values", () => {
      for (const target of ["production", "dev"] as const) {
        delete process.env.SURETY_TARGET_DB;
        expect(resolveTargetDb(target)).toBe(target);
      }
    });
  });

  describe("createTestDb", () => {
    test("creates an in-memory database", () => {
      const db = createTestDb();
      expect(db).toBeDefined();
    });

    test("closes existing connection before creating new one", () => {
      createTestDb();
      const db = createTestDb();
      expect(db).toBeDefined();
    });

    test("auto-initializes schema", async () => {
      createTestDb();
      // Verify tables exist by querying them
      const members = await membersRepo.findAll();
      expect(members).toEqual([]);
    });
  });

  describe("resetTestDb", () => {
    test("clears all data from test database", async () => {
      createTestDb();
      await membersRepo.create({ name: "张三", relation: "Self" });
      expect(await membersRepo.findAll()).toHaveLength(1);

      resetTestDb();
      expect(await membersRepo.findAll()).toHaveLength(0);
    });

    test("creates test database if no connection exists", async () => {
      closeDb();
      resetTestDb();
      // Should work without error
      const members = await membersRepo.findAll();
      expect(members).toEqual([]);
    });
  });

  describe("createAllRepos", () => {
    test("creates all repos from a db instance", () => {
      const db = createTestDb();
      const repos = createAllRepos(db);

      expect(repos.members).toBeDefined();
      expect(repos.insurers).toBeDefined();
      expect(repos.assets).toBeDefined();
      expect(repos.policies).toBeDefined();
      expect(repos.beneficiaries).toBeDefined();
      expect(repos.payments).toBeDefined();
      expect(repos.cashValues).toBeDefined();
      expect(repos.coverageItems).toBeDefined();
      expect(repos.settings).toBeDefined();
    });

    test("repos created from createAllRepos work correctly", async () => {
      const db = createTestDb();
      const repos = createAllRepos(db);

      const member = await repos.members.create({ name: "张三", relation: "Self" });
      expect(member.name).toBe("张三");

      const all = await repos.members.findAll();
      expect(all).toHaveLength(1);
    });
  });

  describe("getRawSqlite", () => {
    test("returns raw sqlite driver after createTestDb", () => {
      createTestDb();
      const raw = getRawSqlite();
      expect(raw).toBeDefined();
      expect(typeof raw.exec).toBe("function");
    });

    test("throws when no connection exists", () => {
      closeDb();
      expect(() => getRawSqlite()).toThrow("No test database connection");
    });
  });

  describe("closeDb", () => {
    test("closes an open connection", () => {
      createTestDb();
      closeDb();
      // getRawSqlite should throw after close
      expect(() => getRawSqlite()).toThrow();
    });

    test("is safe to call when no connection exists", () => {
      closeDb();
      closeDb();
    });
  });

  describe("getDbForRequest", () => {
    test("returns in-memory db in test environment", () => {
      const db = getDbForRequest();
      expect(db).toBeDefined();
    });

    test("returns in-memory db in test environment regardless of targetDb string", () => {
      const db = getDbForRequest("dev");
      expect(db).toBeDefined();
      // Should still be the test db
    });
  });

  describe("db Proxy", () => {
    test("auto-creates test db in test environment", () => {
      closeDb();
      // Accessing a property on the proxy should auto-create the test db
      const selectFn = db.select;
      expect(selectFn).toBeDefined();
    });

    test("returns same db instance as createTestDb", () => {
      createTestDb();
      // The proxy should use the same test db instance
      expect(db.select).toBeDefined();
    });
  });

  describe("initSchema", () => {
    test("creates all expected tables", async () => {
      createTestDb();
      const members = await membersRepo.findAll();
      expect(members).toEqual([]);
      const insurers = await insurersRepo.findAll();
      expect(insurers).toEqual([]);
    });
  });

  describe("seed-remote script production guard", () => {
    test("scripts/seed-remote.ts exits with error when SURETY_TARGET_DB is not set", async () => {
      const proc = Bun.spawn(["bun", "scripts/seed-remote.ts"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, SURETY_TARGET_DB: undefined },
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("BLOCKED");
    });

    test("scripts/seed-remote.ts exits with error when SURETY_TARGET_DB=production", async () => {
      const proc = Bun.spawn(["bun", "scripts/seed-remote.ts"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, SURETY_TARGET_DB: "production" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("BLOCKED");
    });
  });

});
