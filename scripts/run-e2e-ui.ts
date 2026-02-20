#!/usr/bin/env bun
/**
 * Playwright E2E UI Test Runner
 *
 * This script:
 * 1. Creates and seeds E2E database
 * 2. Starts dev server on dedicated port
 * 3. Runs Playwright tests
 * 4. Cleans up
 */

import { spawn, type Subprocess } from "bun";
import { existsSync, unlinkSync, rmSync } from "fs";

const E2E_UI_PORT = process.env.E2E_UI_PORT || "7017";
const E2E_DB_FILE = "database/surety.e2e-ui.db";
const E2E_DIST_DIR = ".next-e2e-ui";

let serverProcess: Subprocess | null = null;

async function waitForServer(maxAttempts = 60): Promise<boolean> {
  const baseUrl = `http://localhost:${E2E_UI_PORT}`;
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

  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${E2E_DB_FILE}${suffix}`;
    if (existsSync(file)) {
      unlinkSync(file);
      console.log(`   Removed ${file}`);
    }
  }

  if (existsSync(E2E_DIST_DIR)) {
    rmSync(E2E_DIST_DIR, { recursive: true, force: true });
    console.log(`   Removed ${E2E_DIST_DIR}`);
  }
}

async function main() {
  console.log("🎭 Playwright E2E UI Test Runner\n");

  // Cleanup any existing artifacts
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${E2E_DB_FILE}${suffix}`;
    if (existsSync(file)) unlinkSync(file);
  }

  // Step 1: Seed E2E database
  console.log("📦 Seeding E2E UI database...");
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
  console.log("\n🌐 Starting E2E UI server on port", E2E_UI_PORT, "...");
  serverProcess = spawn(["bun", "run", "next", "dev", "-p", E2E_UI_PORT], {
    env: {
      ...process.env,
      SURETY_DB: E2E_DB_FILE,
      NEXT_DIST_DIR: E2E_DIST_DIR,
      E2E_SKIP_AUTH: "true",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const ready = await waitForServer();
  if (!ready) {
    console.error("❌ Failed to start E2E UI server");
    await cleanup();
    process.exit(1);
  }
  console.log("✅ E2E UI server ready!\n");

  // Step 3: Run Playwright tests
  console.log("🎭 Running Playwright tests...\n");
  const testResult = Bun.spawnSync(
    [
      "bunx",
      "playwright",
      "test",
      "--config",
      "e2e/playwright.config.ts",
      ...process.argv.slice(2), // pass through CLI args (e.g. --headed, --grep)
    ],
    {
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        E2E_UI_PORT,
      },
    }
  );

  // Step 4: Cleanup
  await cleanup();

  console.log(
    "\n" +
      (testResult.exitCode === 0
        ? "✅ Playwright E2E tests passed!"
        : "❌ Playwright E2E tests failed!")
  );
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
