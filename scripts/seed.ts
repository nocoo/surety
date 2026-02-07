import { initSchema, resetTestDb } from "../src/db";
import { seedDatabase } from "../src/db/seed";

async function seed() {
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
