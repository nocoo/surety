import { existsSync, unlinkSync } from "fs";
import { spawn, type Subprocess } from "bun";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:7015";
const E2E_DB_FILE = "surety.e2e.db";

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
 */
export async function setupE2E(): Promise<void> {
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

  // Start dev server with E2E database
  serverProcess = spawn(["bun", "run", "dev"], {
    env: {
      ...process.env,
      SURETY_DB: E2E_DB_FILE,
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
 */
export async function teardownE2E(): Promise<void> {
  // Stop server
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    // Wait a bit for process to die
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Clean up E2E database
  if (existsSync(E2E_DB_FILE)) {
    unlinkSync(E2E_DB_FILE);
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
