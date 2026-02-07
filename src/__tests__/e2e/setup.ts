import { existsSync, copyFileSync, unlinkSync } from "fs";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:7015";
const DB_FILE = "surety.db";
const DB_BACKUP = "surety.db.e2e-backup";

export function getBaseUrl(): string {
  return BASE_URL;
}

async function waitForServer(maxAttempts = 10): Promise<boolean> {
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

export async function setupE2E(): Promise<void> {
  if (existsSync(DB_FILE)) {
    copyFileSync(DB_FILE, DB_BACKUP);
  }

  const ready = await waitForServer();
  if (!ready) {
    throw new Error(
      `E2E server not available at ${BASE_URL}. Start with: bun dev`
    );
  }
}

export async function teardownE2E(): Promise<void> {
  if (existsSync(DB_BACKUP)) {
    copyFileSync(DB_BACKUP, DB_FILE);
    unlinkSync(DB_BACKUP);
  }
}

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
