#!/usr/bin/env bun
/**
 * E2E Test Runner
 *
 * This script:
 * 1. Ensures the target port is free
 * 2. Seeds remote D1 dev database
 * 3. Starts dev server on dedicated port
 * 4. Runs E2E tests
 * 5. Cleans up
 */

import { spawn, type Subprocess } from "bun";
import { existsSync, rmSync } from "fs";
import { ensurePortFree, withE2eLock } from "./e2e-utils";

const E2E_PORT = process.env.E2E_PORT || "7016";
const E2E_DIST_DIR = ".next-e2e";
const E2E_DIST_DIR_ABS = "apps/web/.next-e2e";

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

  if (existsSync(E2E_DIST_DIR_ABS)) {
    rmSync(E2E_DIST_DIR_ABS, { recursive: true, force: true });
    console.log(`   Removed ${E2E_DIST_DIR_ABS}`);
  }
}

async function main() {
  console.log("🚀 E2E Test Runner\n");

  await withE2eLock(async () => {
    // Step 0: Ensure port is free
    await ensurePortFree(E2E_PORT);

    // Step 1: Seed remote D1 test database
    console.log("📦 Seeding remote D1 test database...");
    const seedResult = Bun.spawnSync(["bun", "run", "apps/web/scripts/seed-remote.ts"], {
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        SURETY_TARGET_DB: "test",
      },
    });

    if (seedResult.exitCode !== 0) {
      console.error("❌ Failed to seed remote D1 test database");
      process.exit(1);
    }

    // Step 2: Start dev server pointing to remote D1 test
    console.log("\n🌐 Starting E2E server on port", E2E_PORT, "...");
    serverProcess = spawn(["bun", "run", "next", "dev", "-p", E2E_PORT], {
      cwd: "apps/web",
      env: {
        ...process.env,
        SURETY_TARGET_DB: "test",
        NEXT_DIST_DIR: E2E_DIST_DIR,
        E2E_SKIP_AUTH: "true",
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const ready = await waitForServer();
    if (!ready) {
      // Dump server output on failure for debugging
      if (serverProcess) {
        const stdout = serverProcess.stdout && typeof serverProcess.stdout !== "number"
          ? await new Response(serverProcess.stdout).text() : "";
        const stderr = serverProcess.stderr && typeof serverProcess.stderr !== "number"
          ? await new Response(serverProcess.stderr).text() : "";
        if (stdout) console.error("Server stdout:\n", stdout);
        if (stderr) console.error("Server stderr:\n", stderr);
      }
      console.error("❌ Failed to start E2E server");
      await cleanup();
      process.exit(1);
    }
    console.log("✅ E2E server ready!\n");

    // Step 3: Run E2E tests (without setup/teardown)
    console.log("🧪 Running E2E tests...\n");
    const testResult = Bun.spawnSync(
      ["bun", "test", "apps/web/src/__tests__/e2e", "--path-ignore-patterns", "__none__", "--timeout", "30000"],
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

    console.log(
      "\n" +
        (testResult.exitCode === 0
          ? "✅ E2E tests passed!"
          : "❌ E2E tests failed!")
    );
    process.exit(testResult.exitCode ?? 1);
  });
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
