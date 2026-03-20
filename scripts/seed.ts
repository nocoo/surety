/**
 * Seed script — populates a database with demo data.
 *
 * SAFETY: This script REFUSES to operate on database/surety.db (production) or
 * database/surety.example.db. You must explicitly set SURETY_DB to a safe target:
 *
 *   SURETY_DB=database/surety.e2e.db bun scripts/seed.ts
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../src/db/schema";
import { createAllRepos } from "../src/db/repositories";
import { familyMembers, familyAssets, policySeedData } from "../src/db/seed";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BLOCKED_TARGETS = ["database/surety.db", "database/surety.example.db"];

function assertNotProduction(): void {
  const target = process.env.SURETY_DB;
  if (!target) {
    console.error(
      "❌ BLOCKED: SURETY_DB is not set. This script defaults to database/surety.db (production),\n" +
      "   which would DESTROY all real policy data.\n\n" +
      "   To seed the E2E database:\n" +
      "     SURETY_DB=database/surety.e2e.db bun scripts/seed.ts\n"
    );
    process.exit(1);
  }

  if (BLOCKED_TARGETS.includes(target)) {
    console.error(
      `❌ BLOCKED: Refusing to seed "${target}" — this is a protected database.\n\n` +
      "   To seed the E2E database:\n" +
      "     SURETY_DB=database/surety.e2e.db bun scripts/seed.ts\n"
    );
    process.exit(1);
  }
}

function initSchema(sqlite: InstanceType<typeof Database>): void {
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
}

function clearAllData(sqlite: InstanceType<typeof Database>): void {
  sqlite.exec(`
    DELETE FROM coverage_items; DELETE FROM cash_values; DELETE FROM payments;
    DELETE FROM beneficiaries; DELETE FROM policies; DELETE FROM assets;
    DELETE FROM insurers; DELETE FROM members; DELETE FROM settings;
    DELETE FROM sqlite_sequence;
  `);
}

async function seed() {
  assertNotProduction();

  const dbPath = resolve(PROJECT_ROOT, process.env.SURETY_DB!);
  console.log(`Seeding database: ${dbPath}`);

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  const repos = createAllRepos(db);

  console.log("Initializing schema...");
  initSchema(sqlite);

  console.log("Clearing existing data...");
  clearAllData(sqlite);

  console.log("Seeding data...");

  // Seed members
  const memberMap = new Map<string, number>();
  for (const member of familyMembers) {
    const created = await repos.members.create(member);
    memberMap.set(member.name, created.id);
  }

  // Seed assets
  for (const asset of familyAssets) {
    const ownerId = memberMap.get(asset.ownerName);
    await repos.assets.create({
      type: asset.type, name: asset.name, identifier: asset.identifier,
      ownerId, details: asset.details,
    });
  }

  // Seed insurers
  const uniqueInsurers = [...new Set(policySeedData.map((s) => s.policy.insurerName))];
  for (const name of uniqueInsurers) {
    await repos.insurers.findOrCreate(name);
  }

  // Seed policies
  for (const seedItem of policySeedData) {
    const applicantId = memberMap.get(seedItem.applicantName)!;
    const insuredMemberId = seedItem.insuredName ? memberMap.get(seedItem.insuredName) : undefined;

    const policy = await repos.policies.create({
      ...seedItem.policy, applicantId, insuredMemberId,
    });

    if (seedItem.beneficiaries) {
      for (const b of seedItem.beneficiaries) {
        await repos.beneficiaries.create({
          policyId: policy.id,
          memberId: b.memberName ? memberMap.get(b.memberName) : undefined,
          externalName: b.externalName,
          sharePercent: b.sharePercent, rankOrder: b.rankOrder,
        });
      }
    }
  }

  await repos.settings.set("annualIncome", "600000");

  sqlite.close();

  console.log("\n✅ Seed completed!");
  console.log(`  Members: ${familyMembers.length}`);
  console.log(`  Assets: ${familyAssets.length}`);
  console.log(`  Policies: ${policySeedData.length}`);
}

seed().catch(console.error);
