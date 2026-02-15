#!/usr/bin/env bun
/**
 * Script to generate the example database with demo data.
 * 
 * Usage: bun run scripts/seed-example.ts
 * 
 * This will create surety.example.db with realistic anonymized data.
 */

import { getDb, initSchema, closeDb } from "../src/db/index";
import { seedExampleDatabase } from "../src/db/seed-example";

// Set environment to use example database
process.env.SURETY_DB = "database/surety.example.db";

console.log("🗃️  Creating example database...");
console.log("   Database file: database/surety.example.db\n");

// Initialize database connection first
console.log("📋 Initializing schema...");
getDb(); // This creates the database connection
initSchema();

// Seed data
console.log("🌱 Seeding example data...\n");
const result = seedExampleDatabase();

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

closeDb();

console.log("\n🎉 Done! You can now select '示例数据' in the app.");
