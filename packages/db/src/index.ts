import * as schema from "./schema";

/**
 * Dual-driver Drizzle handle (D1 | bun:sqlite). Aliased to `any` because the
 * union over Drizzle's generics is impractical to spell without dragging
 * heavy generics into every repo signature — same escape hatch as lyre.
 */
// biome-ignore lint/suspicious/noExplicitAny: dual-driver Drizzle escape hatch — see doc above
export type DbInstance = any;

// ---------- D1 binding driver (Cloudflare Worker) ----------

/**
 * Create a Drizzle instance backed by a D1 binding.
 * Used by Hono Worker routes with direct D1 access.
 *
 * Accepts any object conforming to the D1Database interface
 * (typed loosely to avoid requiring @cloudflare/workers-types here).
 */
// biome-ignore lint/suspicious/noExplicitAny: D1 binding typed loosely to avoid @cloudflare/workers-types dep
export function createDbFromD1(d1: any): DbInstance {
	// Dynamic require keeps workers-types optional for non-Worker consumers.
	const { drizzle } = require("drizzle-orm/d1") as typeof import("drizzle-orm/d1");
	return drizzle(d1, { schema });
}

// ---------- Environment helpers ----------

function isTestEnv(): boolean {
	return process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test";
}

// ---------- Test database (bun:sqlite :memory:) ----------

// biome-ignore lint/suspicious/noExplicitAny: bun:sqlite Database type via require only in tests
let testSqlite: any = null;
let testDbInstance: DbInstance = null;

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

	const { Database } = require("bun:sqlite") as typeof import("bun:sqlite");
	const { drizzle } = require("drizzle-orm/bun-sqlite") as typeof import("drizzle-orm/bun-sqlite");

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
    DELETE FROM api_tokens;
    DELETE FROM medical_visits;
    DELETE FROM doctors;
    DELETE FROM hospitals;
    DELETE FROM attachments;
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
 * Canonical schema DDL — the single source of truth for environments
 * provisioned outside of drizzle-kit (in-memory unit tests, the L2-HTTP
 * wrangler-local D1 runner, ad-hoc seed scripts).
 *
 * Native D1 uses apps/worker/migrations. The environment verification
 * asserts parity with this unit-test DDL before exercising native resources.
 */
export const INIT_SQL = `
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
      terminated_at TEXT,
      termination_reason TEXT,
      planned_surrender_at TEXT,
      planned_surrender_note TEXT,
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

    CREATE UNIQUE INDEX IF NOT EXISTS unique_policy_period ON payments(policy_id, period_number);

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

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES policies(id),
      filename TEXT NOT NULL,
      r2_key TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_policy_id ON attachments(policy_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT,
      is_public INTEGER DEFAULT 1,
      address TEXT,
      phone TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
      department TEXT NOT NULL,
      title TEXT,
      specialty TEXT,
      phone TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medical_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id),
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
      doctor_id INTEGER REFERENCES doctors(id),
      visit_date TEXT NOT NULL,
      visit_time_start TEXT,
      visit_time_end TEXT,
      visit_type TEXT NOT NULL,
      visit_reason TEXT NOT NULL,
      department TEXT,
      symptoms TEXT,
      diagnosis TEXT,
      treatment TEXT,
      total_cost REAL,
      insurance_paid REAL,
      self_paid REAL,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT DEFAULT 'CLI',
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_api_tokens_email ON api_tokens(email);

    CREATE INDEX IF NOT EXISTS idx_policies_insurer_id ON policies(insurer_id);
    CREATE INDEX IF NOT EXISTS idx_policies_insured_member_id ON policies(insured_member_id);
    CREATE INDEX IF NOT EXISTS idx_policies_insured_asset_id ON policies(insured_asset_id);
    CREATE INDEX IF NOT EXISTS idx_beneficiaries_policy_id ON beneficiaries(policy_id);
    CREATE INDEX IF NOT EXISTS idx_payments_policy_id ON payments(policy_id);
    CREATE INDEX IF NOT EXISTS idx_coverage_items_policy_id ON coverage_items(policy_id);
    CREATE INDEX IF NOT EXISTS idx_medical_visits_member_id ON medical_visits(member_id);
    CREATE INDEX IF NOT EXISTS idx_medical_visits_hospital_id ON medical_visits(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_medical_visits_doctor_id ON medical_visits(doctor_id);
`;

/**
 * Initialize schema on the current test SQLite connection.
 * All CREATE TABLE IF NOT EXISTS — idempotent.
 */
export function initSchema(): void {
	if (!testSqlite) throw new Error("No test database connection");
	testSqlite.exec(INIT_SQL);
}

/**
 * Get the raw test SQLite driver instance.
 * Used by backup/restore tests to run raw SQL.
 */
// biome-ignore lint/suspicious/noExplicitAny: returns bun:sqlite Database; typed any to avoid test-only dep leak
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

export const db = new Proxy({} as DbInstance, {
	get(_, prop) {
		if (!isTestEnv())
			throw new Error("Database globals are test-only; use request-scoped D1 repositories");
		if (!testDbInstance) createTestDb();
		return testDbInstance[prop];
	},
});
