#!/usr/bin/env bun
/**
 * Remote D1 Seed Script
 *
 * Seeds a remote D1 database via the Worker proxy.
 * Reuses seedDatabase() from src/db/seed.ts with repo injection.
 *
 * SAFETY: Refuses to seed "production". SURETY_TARGET_DB must be explicitly set.
 *
 * Usage:
 *   SURETY_TARGET_DB=dev bun scripts/seed-remote.ts
 *
 * Requires SURETY_WORKER_URL and SURETY_WORKER_SECRET in .env.
 */

import { createRemoteDb, type TargetDb } from "../src/db/index";
import { createAllRepos } from "../src/db/repositories";
import { seedDatabase } from "../src/db/seed";
import { sql } from "drizzle-orm";

const BLOCKED_TARGETS = ["production"];

function getTargetDb(): TargetDb {
  const target = process.env.SURETY_TARGET_DB;
  if (!target) {
    console.error(
      "❌ BLOCKED: SURETY_TARGET_DB is not set.\n\n" +
      "   Usage: SURETY_TARGET_DB=dev bun scripts/seed-remote.ts\n",
    );
    process.exit(1);
  }

  if (BLOCKED_TARGETS.includes(target)) {
    console.error(
      `❌ BLOCKED: Refusing to seed "${target}" — this is a protected database.\n\n` +
      "   Usage: SURETY_TARGET_DB=dev bun scripts/seed-remote.ts\n",
    );
    process.exit(1);
  }

  return target as TargetDb;
}

async function main() {
  const targetDb = getTargetDb();

  if (!process.env.SURETY_WORKER_URL || !process.env.SURETY_WORKER_SECRET) {
    console.error(
      "❌ SURETY_WORKER_URL and SURETY_WORKER_SECRET must be set.\n" +
      "   These are required to connect to the Worker proxy.\n",
    );
    process.exit(1);
  }

  console.log(`🌱 Remote seed: target = ${targetDb}`);
  console.log(`   Worker URL: ${process.env.SURETY_WORKER_URL}\n`);

  // Create remote DB connection
  const db = createRemoteDb(targetDb);
  const repos = createAllRepos(db);

  // Clear existing data (order matters for FK constraints)
  console.log("🗑️  Clearing existing data...");
  const tables = [
    "coverage_items", "cash_values", "payments", "beneficiaries",
    "policies", "assets", "insurers", "members", "settings",
  ];
  for (const table of tables) {
    await db.run(sql.raw(`DELETE FROM ${table}`));
  }
  // Reset autoincrement
  try {
    await db.run(sql.raw("DELETE FROM sqlite_sequence"));
  } catch {
    // sqlite_sequence may not exist if no AUTOINCREMENT was used
  }

  // Seed data
  console.log("📦 Seeding data...");
  const result = await seedDatabase(repos);

  console.log("\n✅ Remote seed completed!");
  console.log(`   Members: ${result.members}`);
  console.log(`   Assets: ${result.assets}`);
  console.log(`   Policies: ${result.policies}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
