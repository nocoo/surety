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
 *   SURETY_TARGET_DB=test bun scripts/seed-remote.ts
 *
 * Requires SURETY_WORKER_URL and SURETY_WORKER_SECRET in .env.
 */

import { createRemoteDb, type TargetDb } from "../src/db/index";
import { createAllRepos } from "../src/db/repositories";
import { seedDatabase } from "../src/db/seed";
import { WorkerDbClient } from "../src/db/worker-db-client";

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

  const workerUrl = process.env.SURETY_WORKER_URL;
  const workerSecret = process.env.SURETY_WORKER_SECRET;

  if (!workerUrl || !workerSecret) {
    console.error(
      "❌ SURETY_WORKER_URL and SURETY_WORKER_SECRET must be set.\n" +
      "   These are required to connect to the Worker proxy.\n",
    );
    process.exit(1);
  }

  console.log(`🌱 Remote seed: target = ${targetDb}`);
  console.log(`   Worker URL: ${workerUrl}\n`);

  // Atomic batch DELETE (all-or-nothing via D1 batch)
  console.log("🗑️  Clearing existing data (atomic batch)...");
  const tables = [
    "coverage_items", "cash_values", "payments", "beneficiaries",
    "policies", "assets", "insurers", "members", "settings",
  ];
  const client = new WorkerDbClient(workerUrl, workerSecret, targetDb);
  await client.batch([
    ...tables.map((t) => ({ sql: `DELETE FROM ${t}`, params: [] })),
    { sql: "DELETE FROM sqlite_sequence", params: [] },
  ]);

  // Seed data (sequential INSERT via repos)
  console.log("📦 Seeding data...");
  const db = createRemoteDb(targetDb);
  const repos = createAllRepos(db);
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
