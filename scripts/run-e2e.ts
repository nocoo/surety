#!/usr/bin/env bun
/**
 * E2E Test Runner
 * 
 * This script:
 * 1. Creates and seeds E2E database
 * 2. Starts dev server on dedicated port
 * 3. Runs E2E tests
 * 4. Cleans up
 */

import { spawn, type Subprocess } from "bun";
import { existsSync, unlinkSync, rmSync } from "fs";

const E2E_PORT = process.env.E2E_PORT || "7016";
const E2E_DB_FILE = "surety.e2e.db";
const E2E_DIST_DIR = ".next-e2e";

let serverProcess: Subprocess | null = null;

async function waitForServer(maxAttempts = 60): Promise<boolean> {
  const baseUrl = `http://localhost:${E2E_PORT}`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/members`);
      if (response.ok) return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

async function cleanup() {
  console.log("\n🧹 Cleaning up...");
  
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (existsSync(E2E_DB_FILE)) {
    unlinkSync(E2E_DB_FILE);
    console.log(`   Removed ${E2E_DB_FILE}`);
  }

  if (existsSync(E2E_DIST_DIR)) {
    rmSync(E2E_DIST_DIR, { recursive: true, force: true });
    console.log(`   Removed ${E2E_DIST_DIR}`);
  }
}

async function main() {
  console.log("🚀 E2E Test Runner\n");

  // Cleanup any existing E2E artifacts
  if (existsSync(E2E_DB_FILE)) {
    unlinkSync(E2E_DB_FILE);
  }

  // Step 1: Seed E2E database
  console.log("📦 Seeding E2E database...");
  const seedResult = Bun.spawnSync(["bun", "run", "scripts/seed-e2e.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      SURETY_DB: E2E_DB_FILE,
    },
  });

  if (seedResult.exitCode !== 0) {
    console.error("❌ Failed to seed E2E database");
    process.exit(1);
  }

  // Step 2: Start dev server
  console.log("\n🌐 Starting E2E server on port", E2E_PORT, "...");
  serverProcess = spawn(["bun", "run", "next", "dev", "-p", E2E_PORT], {
    env: {
      ...process.env,
      SURETY_DB: E2E_DB_FILE,
      NEXT_DIST_DIR: E2E_DIST_DIR,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const ready = await waitForServer();
  if (!ready) {
    console.error("❌ Failed to start E2E server");
    await cleanup();
    process.exit(1);
  }
  console.log("✅ E2E server ready!\n");

  // Step 3: Run E2E tests (without setup/teardown)
  console.log("🧪 Running E2E tests...\n");
  const testResult = Bun.spawnSync(
    ["bun", "test", "src/__tests__/e2e", "--timeout", "30000"],
    {
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        E2E_SKIP_SETUP: "true",
        E2E_PORT,
      },
    }
  );

  // Step 4: Cleanup
  await cleanup();

  console.log("\n" + (testResult.exitCode === 0 ? "✅ E2E tests passed!" : "❌ E2E tests failed!"));
  process.exit(testResult.exitCode ?? 1);
}

// Handle process signals
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(1);
});

main();
