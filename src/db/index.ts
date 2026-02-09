import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbInstance = any;

// Database type for multi-database support
export type DatabaseType = "production" | "example" | "test";

// Project root directory (where db files live), resolved from this source file
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Resolve a database filename to an absolute path under the project root. */
function resolveDbPath(filename: string): string {
  // In-memory and already-absolute paths are passed through
  if (filename === ":memory:" || filename.startsWith("/")) return filename;
  return resolve(PROJECT_ROOT, filename);
}

// Database file mapping (relative names, resolved at use-site)
const DATABASE_FILES: Record<DatabaseType, string> = {
  production: "surety.db",
  example: "surety.example.db",
  test: "surety.e2e.db",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbInstance: any;
let currentDbFile: string | null = null;

// Detect if running in Bun runtime
const isBun = typeof globalThis.Bun !== "undefined";

// Database file paths
const E2E_DB_FILE = "surety.e2e.db";

/**
 * Get the current database type from environment or cookie.
 * Priority: SURETY_DB env > cookie > default (production)
 */
export function getCurrentDatabaseType(): DatabaseType {
  // Environment variable takes precedence
  const envDb = process.env.SURETY_DB;
  if (envDb) {
    if (envDb === E2E_DB_FILE || envDb.includes("e2e")) return "test";
    if (envDb.includes("example")) return "example";
    return "production";
  }
  
  // For server-side, we need to check cookies
  // This is done asynchronously via the API route
  return "production";
}

/**
 * Get the database file path for a given database type.
 */
export function getDatabaseFile(dbType: DatabaseType): string {
  return DATABASE_FILES[dbType];
}

// Files that must NEVER be opened during test runs.
// Tests have historically deleted these files, destroying user data.
const PROTECTED_FILES = new Set([
  resolveDbPath("surety.db"),
  resolveDbPath("surety.example.db"),
]);

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test";
}

function createDatabase(filename: string): DbInstance {
  const resolvedPath = resolveDbPath(filename);

  // Guard: block tests from touching production or example databases
  if (isTestEnv() && PROTECTED_FILES.has(resolvedPath)) {
    throw new Error(
      `BLOCKED: Tests must not open protected database "${filename}". ` +
      `Use createTestDb() (:memory:) or surety.e2e.db instead.`
    );
  }

  // If switching to a different database, close the existing connection
  if (sqlite && currentDbFile !== resolvedPath) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
  }
  
  if (dbInstance && currentDbFile === resolvedPath) {
    return dbInstance;
  }
  
  currentDbFile = resolvedPath;
  
  if (isBun) {
    // Bun runtime: use bun:sqlite
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/bun-sqlite");
    sqlite = new Database(resolvedPath);
    dbInstance = drizzle(sqlite, { schema });
  } else {
    // Node.js runtime: use better-sqlite3
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    sqlite = new Database(resolvedPath);
    dbInstance = drizzle(sqlite, { schema });
  }

  // Auto-initialize schema (CREATE TABLE IF NOT EXISTS is idempotent)
  initSchema();

  return dbInstance;
}

/**
 * Get database instance for the specified database type.
 */
export function getDbForType(dbType: DatabaseType): DbInstance {
  const filename = DATABASE_FILES[dbType];
  return createDatabase(filename);
}

/**
 * Get database instance using environment variable or default.
 * Note: For server-side cookie-based switching, set SURETY_DB env var
 * before calling this function (e.g., in middleware/proxy).
 */
export function getDb(): DbInstance {
  const envDb = process.env.SURETY_DB;
  const filename = envDb || DATABASE_FILES.production;
  return createDatabase(filename);
}

/**
 * Switch to a specific database type.
 * This closes any existing connection and opens the new database.
 */
export function switchDatabase(dbType: DatabaseType): DbInstance {
  const filename = DATABASE_FILES[dbType];
  const resolvedPath = resolveDbPath(filename);
  // Only reconnect if the database file is different
  if (currentDbFile === resolvedPath && dbInstance) {
    return dbInstance;
  }
  // Force reconnection by closing existing
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
    currentDbFile = null;
  }
  process.env.SURETY_DB = filename;
  return createDatabase(filename);
}

/**
 * Ensure the database connection matches the specified type.
 * Only switches if necessary (avoids unnecessary reconnections).
 */
export function ensureDatabase(dbType: DatabaseType): DbInstance {
  const filename = DATABASE_FILES[dbType];
  const resolvedPath = resolveDbPath(filename);
  if (currentDbFile === resolvedPath && dbInstance) {
    return dbInstance;
  }
  return switchDatabase(dbType);
}

/**
 * Ensure the database connection matches the cookie setting.
 * Call this at the start of API route handlers.
 * Must be called with the result of cookies().get("surety-database")?.value
 * 
 * Note: SURETY_DB environment variable takes precedence over cookie.
 * This ensures E2E tests (which set SURETY_DB) work correctly.
 */
export function ensureDatabaseFromCookie(cookieValue: string | undefined): DbInstance {
  // Environment variable takes precedence (for E2E tests)
  const envDb = process.env.SURETY_DB;
  if (envDb) {
    let envDbType: DatabaseType = "production";
    if (envDb === E2E_DB_FILE || envDb.includes("e2e")) {
      envDbType = "test";
    } else if (envDb.includes("example")) {
      envDbType = "example";
    }
    return ensureDatabase(envDbType);
  }
  
  // Fall back to cookie value
  const dbType = (cookieValue || "production") as DatabaseType;
  if (!DATABASE_FILES[dbType]) {
    return ensureDatabase("production");
  }
  return ensureDatabase(dbType);
}

export function createTestDb(): DbInstance {
  // Ensure we close any existing connection first
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
    currentDbFile = null;
  }
  createDatabase(":memory:");
  return dbInstance;
}

/**
 * Creates or resets the E2E test database.
 * Returns the database file path for the dev server to use.
 */
export function createE2EDb(): string {
  // Close existing connection if any
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
  }
  
  createDatabase(E2E_DB_FILE);
  return E2E_DB_FILE;
}

/**
 * Resets E2E database by clearing all data.
 */
export function resetE2EDb(): void {
  if (!sqlite) {
    createDatabase(E2E_DB_FILE);
  }
  
  sqlite!.exec(`
    DELETE FROM policy_extensions;
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
 * Get the E2E database file path.
 */
export function getE2EDbPath(): string {
  return E2E_DB_FILE;
}

export function resetTestDb(): void {
  // Ensure test database is initialized
  if (!sqlite) {
    createTestDb();
    return; // createTestDb already initializes an empty schema
  }
  
  sqlite!.exec(`
    DELETE FROM policy_extensions;
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
 * Check if using E2E database.
 */
export function isE2EMode(): boolean {
  return currentDbFile === resolveDbPath(E2E_DB_FILE) || process.env.SURETY_E2E === "true";
}

export function initSchema(): void {
  sqlite!.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      relation TEXT NOT NULL,
      gender TEXT,
      birth_date TEXT,
      id_card TEXT,
      phone TEXT,
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
      status TEXT NOT NULL DEFAULT 'Active',
      death_benefit TEXT,
      archived INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS policy_extensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL UNIQUE REFERENCES policies(id),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
    currentDbFile = null;
  }
}

// Dynamic db getter - always uses current environment variable
// This allows database switching at runtime
export const db = new Proxy({} as DbInstance, {
  get(_, prop) {
    // For tests, use in-memory database
    if (process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test") {
      if (!dbInstance) {
        createTestDb();
      }
      return dbInstance[prop];
    }
    
    // Get/create database based on current SURETY_DB env
    const currentDb = getDb();
    return currentDb[prop];
  },
});
