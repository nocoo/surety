#!/usr/bin/env bun
/**
 * MCP Test Seed Script
 *
 * Creates and populates a dedicated test database for MCP E2E tests.
 * This is separate from the web E2E test database.
 *
 * Usage: SURETY_DB=database/surety.mcp-test.db bun run scripts/seed-mcp-test.ts
 */

import { getDb, initSchema, resetTestDb } from "../src/db";
import { seedDatabase } from "../src/db/seed";

// Force database initialization
getDb();

console.log("Initializing MCP test database schema...");
initSchema();

console.log("Clearing existing data...");
resetTestDb();

console.log("Seeding MCP test data...");
const result = seedDatabase();

// Note: mcp.enabled is NOT set here intentionally.
// The guard tests verify that MCP is disabled by default.
// The tool tests use SURETY_MCP_ENABLED env override.

console.log("\nMCP test seed completed!");
console.log(`  Members: ${result.members}`);
console.log(`  Assets: ${result.assets}`);
console.log(`  Policies: ${result.policies}`);
