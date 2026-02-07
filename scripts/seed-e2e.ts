/**
 * E2E Seed Script
 * Creates and populates the E2E test database.
 * 
 * Usage: SURETY_DB=surety.e2e.db bun run scripts/seed-e2e.ts
 */

import { getDb, initSchema, resetTestDb } from "../src/db";
import { seedDatabase } from "../src/db/seed";

// Force database initialization
getDb();

console.log("Initializing E2E database schema...");
initSchema();

console.log("Clearing existing data...");
resetTestDb();

console.log("Seeding E2E data...");
const result = seedDatabase();

console.log("\n✅ E2E Seed completed!");
console.log(`  Members: ${result.members}`);
console.log(`  Assets: ${result.assets}`);
console.log(`  Policies: ${result.policies}`);
