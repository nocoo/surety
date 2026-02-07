import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

export type DbInstance = BunSQLiteDatabase<typeof schema>;

// Use `any` to avoid static import of bun:sqlite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite: any;
let dbInstance: DbInstance;

function createDatabase(filename: string): DbInstance {
  // Dynamic require to avoid static analysis by bundlers
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite");
  sqlite = new Database(filename);
  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

export function getDb(): DbInstance {
  if (!dbInstance) {
    createDatabase("surety.db");
  }
  return dbInstance;
}

export function createTestDb(): DbInstance {
  createDatabase(":memory:");
  initSchema();
  return dbInstance;
}

export function resetTestDb(): void {
  sqlite.exec(`
    DELETE FROM policy_extensions;
    DELETE FROM cash_values;
    DELETE FROM payments;
    DELETE FROM beneficiaries;
    DELETE FROM policies;
    DELETE FROM assets;
    DELETE FROM members;
    DELETE FROM settings;
  `);
}

export function initSchema(): void {
  sqlite.exec(`
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
  }
}

export const db = (() => {
  if (process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test") {
    return createTestDb();
  }
  return getDb();
})();
