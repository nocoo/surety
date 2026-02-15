/**
 * Seed script — populates a database with demo data.
 *
 * SAFETY: This script REFUSES to operate on database/surety.db (production) or
 * database/surety.example.db. You must explicitly set SURETY_DB to a safe target:
 *
 *   SURETY_DB=database/surety.e2e.db bun scripts/seed.ts
 */
import { initSchema, resetTestDb } from "../src/db";
import { seedDatabase } from "../src/db/seed";

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

async function seed() {
  assertNotProduction();

  console.log(`Seeding database: ${process.env.SURETY_DB}`);
  console.log("Initializing database schema...");
  initSchema();

  console.log("Clearing existing data...");
  resetTestDb();

  console.log("Seeding data...");
  const result = seedDatabase();

  console.log("\n✅ Seed completed!");
  console.log(`  Members: ${result.members}`);
  console.log(`  Assets: ${result.assets}`);
  console.log(`  Policies: ${result.policies}`);
}

seed().catch(console.error);
