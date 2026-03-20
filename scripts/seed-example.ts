#!/usr/bin/env bun
/**
 * Script to generate the example database with demo data.
 *
 * Uses bun:sqlite directly (not the D1 Worker proxy) since this is a local script.
 *
 * Usage: SURETY_DB=database/surety.example.db bun run scripts/seed-example.ts
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../src/db/schema";
import { createAllRepos } from "../src/db/repositories";
import { seedExampleDatabase } from "../src/db/seed-example";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BLOCKED_TARGETS = ["database/surety.db"];

const dbFile = process.env.SURETY_DB || "database/surety.example.db";

if (BLOCKED_TARGETS.includes(dbFile)) {
  console.error(
    `❌ BLOCKED: Refusing to seed "${dbFile}" — this is a protected database.\n`
  );
  process.exit(1);
}

const dbPath = resolve(PROJECT_ROOT, dbFile);

console.log("🗃️  Creating example database...");
console.log(`   Database file: ${dbFile}\n`);

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

// Initialize schema
console.log("📋 Initializing schema...");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, relation TEXT NOT NULL,
    gender TEXT, birth_date TEXT, id_card TEXT, id_type TEXT, id_expiry TEXT,
    phone TEXT, has_social_insurance INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS insurers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
    phone TEXT, website TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, name TEXT NOT NULL,
    identifier TEXT NOT NULL, owner_id INTEGER REFERENCES members(id), details TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT, applicant_id INTEGER NOT NULL REFERENCES members(id),
    insured_type TEXT NOT NULL, insured_member_id INTEGER REFERENCES members(id),
    insured_asset_id INTEGER REFERENCES assets(id), category TEXT NOT NULL, sub_category TEXT,
    insurer_id INTEGER REFERENCES insurers(id), insurer_name TEXT NOT NULL,
    product_name TEXT NOT NULL, policy_number TEXT NOT NULL UNIQUE, channel TEXT,
    sum_assured REAL NOT NULL, premium REAL NOT NULL, payment_frequency TEXT NOT NULL,
    payment_years INTEGER, total_payments INTEGER, renewal_type TEXT, payment_account TEXT,
    next_due_date TEXT, effective_date TEXT NOT NULL, expiry_date TEXT, hesitation_end_date TEXT,
    waiting_days INTEGER, guaranteed_renewal_years INTEGER,
    status TEXT NOT NULL DEFAULT 'Active', death_benefit TEXT, policy_file_path TEXT, notes TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS beneficiaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, policy_id INTEGER NOT NULL REFERENCES policies(id),
    member_id INTEGER REFERENCES members(id), external_name TEXT, external_id_card TEXT,
    share_percent REAL NOT NULL, rank_order INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, policy_id INTEGER NOT NULL REFERENCES policies(id),
    period_number INTEGER NOT NULL, due_date TEXT NOT NULL, amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', paid_date TEXT, paid_amount REAL
  );
  CREATE TABLE IF NOT EXISTS cash_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT, policy_id INTEGER NOT NULL REFERENCES policies(id),
    policy_year INTEGER NOT NULL, value REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coverage_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, policy_id INTEGER NOT NULL REFERENCES policies(id),
    name TEXT NOT NULL, period_limit REAL, lifetime_limit REAL, deductible REAL,
    coverage_percent REAL, is_optional INTEGER DEFAULT 0, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
  );
`);

// Clear existing data
sqlite.exec(`
  DELETE FROM coverage_items; DELETE FROM cash_values; DELETE FROM payments;
  DELETE FROM beneficiaries; DELETE FROM policies; DELETE FROM assets;
  DELETE FROM insurers; DELETE FROM members; DELETE FROM settings;
  DELETE FROM sqlite_sequence;
`);

// Seed data
console.log("🌱 Seeding example data...\n");
const repos = createAllRepos(db);
const result = await seedExampleDatabase(repos);

console.log("✅ Example database created successfully!\n");
console.log(`   Members: ${result.members}`);
console.log(`   Assets: ${result.assets}`);
console.log(`   Policies: ${result.policies}`);
console.log("\n📝 Demo data highlights:");
console.log("   - 9 family members (couple + 2 kids + 4 grandparents + 1 pet)");
console.log("   - 3 assets (1 house, 2 cars)");
console.log("   - 21 insurance policies across all categories");
console.log("\n💡 Issues shown in demo:");
console.log("   - Young daughter (2 yo) missing accident insurance");
console.log("   - Grandfather (陈国华) missing accident insurance");
console.log("   - Elderly only have public welfare insurance (普惠险)");

sqlite.close();

console.log("\n🎉 Done! You can now select '示例数据' in the app.");
