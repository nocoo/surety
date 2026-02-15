import { existsSync, unlinkSync, rmSync } from "fs";
import { spawn, type Subprocess } from "bun";

const E2E_PORT = process.env.E2E_PORT || "7016";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`;
const E2E_DB_FILE = "database/surety.e2e.db";
const E2E_DIST_DIR = ".next-e2e";

// Skip setup/teardown when running via run-e2e.ts script
const SKIP_SETUP = process.env.E2E_SKIP_SETUP === "true";

let serverProcess: Subprocess | null = null;

export function getBaseUrl(): string {
  return BASE_URL;
}

async function waitForServer(maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/members`);
      if (response.ok) return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

/**
 * Setup E2E test environment:
 * 1. Clean up any existing E2E database
 * 2. Create and seed E2E database via script
 * 3. Start dev server with E2E database
 * 
 * If E2E_SKIP_SETUP=true, this function is a no-op (used by run-e2e.ts).
 */
export async function setupE2E(): Promise<void> {
  if (SKIP_SETUP) {
    return;
  }
  // Clean up any existing E2E database
  if (existsSync(E2E_DB_FILE)) {
    unlinkSync(E2E_DB_FILE);
  }

  // Create and seed E2E database using seed script
  const seedResult = Bun.spawnSync(["bun", "run", "scripts/seed-e2e.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      SURETY_DB: E2E_DB_FILE,
    },
  });

  if (seedResult.exitCode !== 0) {
    throw new Error("Failed to seed E2E database");
  }

  // Start dev server with E2E database on dedicated port with separate dist dir
  serverProcess = spawn(["bun", "run", "next", "dev", "-p", E2E_PORT], {
    env: {
      ...process.env,
      SURETY_DB: E2E_DB_FILE,
      NEXT_DIST_DIR: E2E_DIST_DIR,
      E2E_SKIP_AUTH: "true", // Skip auth for E2E tests
    },
    stdout: "ignore",
    stderr: "ignore",
  });

  // Wait for server to be ready
  const ready = await waitForServer();
  if (!ready) {
    await teardownE2E();
    throw new Error(
      `E2E server not available at ${BASE_URL}. Failed to start dev server.`
    );
  }
}

/**
 * Teardown E2E test environment:
 * 1. Stop dev server
 * 2. Remove E2E database file
 * 
 * If E2E_SKIP_SETUP=true, this function is a no-op (used by run-e2e.ts).
 */
export async function teardownE2E(): Promise<void> {
  if (SKIP_SETUP) {
    return;
  }
  // Stop server
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    // Wait a bit for process to die
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Clean up E2E database and dist dir
  if (existsSync(E2E_DB_FILE)) {
    unlinkSync(E2E_DB_FILE);
  }
  if (existsSync(E2E_DIST_DIR)) {
    rmSync(E2E_DIST_DIR, { recursive: true, force: true });
  }
}

/**
 * Make API request to E2E server.
 */
export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Expected seed data counts for assertions.
 */
export const SEED_COUNTS = {
  members: 7,
  assets: 3,
  policies: 8,
} as const;
