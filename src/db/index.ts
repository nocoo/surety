/**
 * Database module — request-scoped D1 access via Worker proxy.
 *
 * Production: sqlite-proxy → Cloudflare Worker → D1 binding
 * Test: bun:sqlite :memory: (no network, instant)
 *
 * The key design principle is request-scoped database access:
 * each API route calls getDbForRequest(request) to get a db instance
 * bound to the correct target database (production, api-e2e, etc.).
 */

import * as schema from "./schema";
import { WorkerDbClient, type TargetDb } from "./worker-db-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbInstance = any;

// Re-export TargetDb for consumers
export type { TargetDb };

// ---------- Environment helpers ----------

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test";
}

/**
 * Check if Worker proxy is configured. When false, falls back to local bun:sqlite.
 */
function hasWorkerConfig(): boolean {
  return !!process.env.SURETY_WORKER_URL && !!process.env.SURETY_WORKER_SECRET;
}

function getWorkerUrl(): string {
  const url = process.env.SURETY_WORKER_URL;
  if (!url) throw new Error("SURETY_WORKER_URL is not set");
  return url;
}

function getWorkerSecret(): string {
  const secret = process.env.SURETY_WORKER_SECRET;
  if (!secret) throw new Error("SURETY_WORKER_SECRET is not set");
  return secret;
}

/**
 * Resolve the target D1 database name.
 * Priority: SURETY_TARGET_DB env > cookie > "production"
 *
 * Safety: when E2E_SKIP_AUTH is set (E2E runner), SURETY_TARGET_DB is mandatory.
 * This prevents E2E tests from accidentally hitting production D1.
 */
export function resolveTargetDb(cookieValue?: string): TargetDb {
  const envTarget = process.env.SURETY_TARGET_DB;

  // Guard: E2E runner must explicitly choose a target DB
  if (process.env.E2E_SKIP_AUTH === "true" && !envTarget) {
    throw new Error(
      "E2E safety guard: SURETY_TARGET_DB must be set when E2E_SKIP_AUTH=true. " +
      "This prevents E2E tests from accidentally connecting to production D1.",
    );
  }

  if (envTarget && isValidTargetDb(envTarget)) return envTarget;
  if (cookieValue && isValidTargetDb(cookieValue)) return cookieValue;
  return "production";
}

function isValidTargetDb(value: string): value is TargetDb {
  return ["production", "dev"].includes(value);
}

// ---------- Remote database (sqlite-proxy → Worker proxy) ----------

/**
 * Create a Drizzle instance backed by the Worker proxy (D1).
 * This is the production path — all queries go over HTTP.
 */
export function createRemoteDb(targetDb: TargetDb = "production"): DbInstance {
  const client = new WorkerDbClient(getWorkerUrl(), getWorkerSecret(), targetDb);
  return createRemoteDbFromClient(client);
}

export function createRemoteDbFromClient(client: WorkerDbClient): DbInstance {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/sqlite-proxy");

  return drizzle(
    // single query callback
    async (sql: string, params: unknown[], method: string) => {
      const result = await client.query(sql, params);
      const rows = result.rows.map((row) => Object.values(row));
      // sqlite-proxy: "get" expects a single flat row, "all" expects array-of-arrays
      return { rows: method === "get" ? rows[0] : rows };
    },
    // batch callback
    async (queries: Array<{ sql: string; params: unknown[]; method: string }>) => {
      const results = await client.batch(
        queries.map((q) => ({ sql: q.sql, params: q.params })),
      );
      return results.map((r) => ({
        rows: r.rows.map((row) => Object.values(row)),
      }));
    },
    { schema },
  );
}

// ---------- Local database fallback (bun:sqlite file) ----------

// Cache for local file-based SQLite connections (E2E / dev without Worker)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localSqlite: any = null;
let localDbInstance: DbInstance = null;
let localDbPath: string | null = null;

/**
 * Create or get a Drizzle instance backed by a local SQLite file.
 * Used when Worker proxy is not configured (E2E tests, local dev).
 */
function getLocalDb(): DbInstance {
  const dbPath = process.env.SURETY_DB;
  if (!dbPath) {
    throw new Error(
      "Neither SURETY_WORKER_URL nor SURETY_DB is set. " +
      "Set SURETY_WORKER_URL for D1 access, or SURETY_DB for local SQLite."
    );
  }

  // Return cached instance if path hasn't changed
  if (localDbInstance && localDbPath === dbPath) return localDbInstance;

  // Close previous connection if path changed
  if (localSqlite) {
    localSqlite.close();
    localSqlite = null;
    localDbInstance = null;
    localDbPath = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolve, dirname } = require("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fileURLToPath } = require("url");

  // Resolve relative to project root
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const absolutePath = resolve(projectRoot, dbPath);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/bun-sqlite");

  localSqlite = new Database(absolutePath);
  localDbInstance = drizzle(localSqlite, { schema });
  localDbPath = dbPath;

  return localDbInstance;
}

/**
 * Get a request-scoped database instance.
 *
 * Routing priority:
 * 1. Test env → in-memory SQLite
 * 2. Worker configured (SURETY_WORKER_URL) → remote D1 via sqlite-proxy
 * 3. Local file (SURETY_DB) → local bun:sqlite fallback (E2E / dev)
 *
 * @param requestOrTargetDb - Either a Request (reads cookie) or a TargetDb string
 */
export function getDbForRequest(requestOrTargetDb?: Request | TargetDb): DbInstance {
  if (isTestEnv()) {
    // In test environment, always use in-memory SQLite
    return getTestDb();
  }

  // If Worker proxy is configured, use remote D1
  if (hasWorkerConfig()) {
    let targetDb: TargetDb;

    if (typeof requestOrTargetDb === "string") {
      targetDb = requestOrTargetDb;
    } else if (requestOrTargetDb instanceof Request) {
      // Extract target DB from cookie
      const cookieHeader = requestOrTargetDb.headers.get("cookie") || "";
      const match = cookieHeader.match(/surety-database=([^;]+)/);
      targetDb = resolveTargetDb(match?.[1]);
    } else {
      targetDb = resolveTargetDb();
    }

    return createRemoteDb(targetDb);
  }

  // Fallback: local SQLite file (E2E tests, local dev without Worker)
  return getLocalDb();
}

// ---------- Test database (local bun:sqlite :memory:) ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testSqlite: any = null;
let testDbInstance: DbInstance = null;

/**
 * Get or create the shared test :memory: database.
 * Used in test environment only.
 */
function getTestDb(): DbInstance {
  if (testDbInstance) return testDbInstance;
  return createTestDb();
}

/**
 * Create a fresh in-memory test database.
 * Closes any existing test connection first.
 */
export function createTestDb(): DbInstance {
  if (testSqlite) {
    testSqlite.close();
    testSqlite = null;
    testDbInstance = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/bun-sqlite");

  testSqlite = new Database(":memory:");
  testDbInstance = drizzle(testSqlite, { schema });

  // Auto-initialize schema
  initSchema();

  return testDbInstance;
}

/**
 * Reset the test database by clearing all data.
 * Creates a new :memory: db if none exists.
 */
export function resetTestDb(): void {
  if (!testSqlite) {
    createTestDb();
    return;
  }

  // Ensure schema is up-to-date
  initSchema();

  testSqlite.exec(`
    DELETE FROM coverage_items;
    DELETE FROM cash_values;
    DELETE FROM payments;
    DELETE FROM beneficiaries;
    DELETE FROM policies;
    DELETE FROM assets;
    DELETE FROM insurers;
    DELETE FROM members;
    DELETE FROM settings;
    DELETE FROM sqlite_sequence;
  `);
}

/**
 * Initialize schema on the current test SQLite connection.
 * All CREATE TABLE IF NOT EXISTS — idempotent.
 */
export function initSchema(): void {
  if (!testSqlite) throw new Error("No test database connection");

  testSqlite.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      relation TEXT NOT NULL,
      gender TEXT,
      birth_date TEXT,
      id_card TEXT,
      id_type TEXT,
      id_expiry TEXT,
      phone TEXT,
      has_social_insurance INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS insurers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      phone TEXT,
      website TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      owner_id INTEGER REFERENCES members(id),
      details TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant_id INTEGER NOT NULL REFERENCES members(id),
      insured_type TEXT NOT NULL,
      insured_member_id INTEGER REFERENCES members(id),
      insured_asset_id INTEGER REFERENCES assets(id),
      category TEXT NOT NULL,
      sub_category TEXT,
      insurer_id INTEGER REFERENCES insurers(id),
      insurer_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      policy_number TEXT NOT NULL UNIQUE,
      channel TEXT,
      sum_assured REAL NOT NULL,
      premium REAL NOT NULL,
      payment_frequency TEXT NOT NULL,
      payment_years INTEGER,
      total_payments INTEGER,
      renewal_type TEXT,
      payment_account TEXT,
      next_due_date TEXT,
      effective_date TEXT NOT NULL,
      expiry_date TEXT,
      hesitation_end_date TEXT,
      waiting_days INTEGER,
      guaranteed_renewal_years INTEGER,
      status TEXT NOT NULL DEFAULT 'Active',
      death_benefit TEXT,
      policy_file_path TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beneficiaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES policies(id),
      member_id INTEGER REFERENCES members(id),
      external_name TEXT,
      external_id_card TEXT,
      share_percent REAL NOT NULL,
      rank_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES policies(id),
      period_number INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      paid_date TEXT,
      paid_amount REAL
    );

    CREATE TABLE IF NOT EXISTS cash_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES policies(id),
      policy_year INTEGER NOT NULL,
      value REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coverage_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES policies(id),
      name TEXT NOT NULL,
      period_limit REAL,
      lifetime_limit REAL,
      deductible REAL,
      coverage_percent REAL,
      is_optional INTEGER DEFAULT 0,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

/**
 * Get the raw test SQLite driver instance.
 * Used by backup/restore tests to run raw SQL.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRawSqlite(): any {
  if (!testSqlite) {
    throw new Error("No test database connection. Call createTestDb() first.");
  }
  return testSqlite;
}

/**
 * Close the test database connection.
 */
export function closeDb(): void {
  if (testSqlite) {
    testSqlite.close();
    testSqlite = null;
    testDbInstance = null;
  }
}

// ---------- Proxy for backward compatibility ----------

/**
 * Dynamic db Proxy — routes to the correct database instance.
 *
 * In test environment: uses in-memory SQLite.
 * In production (Worker configured): remote D1 via sqlite-proxy.
 * Fallback (no Worker): local SQLite file via SURETY_DB.
 * Kept for backward compatibility during migration.
 */
export const db = new Proxy({} as DbInstance, {
  get(_, prop) {
    if (isTestEnv()) {
      if (!testDbInstance) createTestDb();
      return testDbInstance[prop];
    }
    // Production with Worker: use remote D1
    if (hasWorkerConfig()) {
      const remoteDb = createRemoteDb(resolveTargetDb());
      return remoteDb[prop];
    }
    // Fallback: local SQLite file
    const localDb = getLocalDb();
    return localDb[prop];
  },
});
