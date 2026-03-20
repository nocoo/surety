import { spawn, type Subprocess } from "bun";

const E2E_PORT = process.env.E2E_PORT || "7016";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`;
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
 * 1. Seed remote D1 dev database
 * 2. Start dev server pointing to remote D1 dev
 *
 * If E2E_SKIP_SETUP=true, this function is a no-op (used by run-e2e.ts).
 */
export async function setupE2E(): Promise<void> {
  if (SKIP_SETUP) {
    return;
  }

  // Seed remote D1 dev database
  const seedResult = Bun.spawnSync(["bun", "run", "scripts/seed-remote.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      SURETY_TARGET_DB: "dev",
    },
  });

  if (seedResult.exitCode !== 0) {
    throw new Error("Failed to seed remote D1 dev database");
  }

  // Start dev server pointing to remote D1 dev
  serverProcess = spawn(["bun", "run", "next", "dev", "-p", E2E_PORT], {
    env: {
      ...process.env,
      SURETY_TARGET_DB: "dev",
      NEXT_DIST_DIR: E2E_DIST_DIR,
      E2E_SKIP_AUTH: "true",
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
