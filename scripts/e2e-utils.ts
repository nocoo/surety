/**
 * Shared E2E utilities for test runner scripts.
 */

import { openSync, closeSync, unlinkSync, statSync } from "fs";

const LOCK_FILE = "/tmp/surety-e2e-seed.lock";
const LOCK_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Execute `fn` while holding an exclusive file lock.
 * Prevents concurrent E2E seed operations on the shared D1 dev database.
 *
 * - Uses `openSync(path, 'wx')` (exclusive create) as the lock primitive
 * - Polls with backoff if lock is held, up to LOCK_TIMEOUT_MS
 * - Stale lock detection: if lockfile age > 2 min, force-removes it
 */
export async function withSeedLock<T>(fn: () => Promise<T>): Promise<T> {
  const fd = acquireLock();
  try {
    return await fn();
  } finally {
    releaseLock(fd);
  }
}

function acquireLock(): number {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      // 'wx' = O_WRONLY | O_CREAT | O_EXCL — fails if file exists
      const fd = openSync(LOCK_FILE, "wx");
      console.log("🔒 Seed lock acquired.");
      return fd;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        throw err; // Unexpected error (permissions, etc.)
      }

      // Lock file exists — check for staleness
      tryRemoveStaleLock();

      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out waiting for seed lock (${LOCK_TIMEOUT_MS / 1000}s). ` +
          `Lock file: ${LOCK_FILE}. Another seed process may be stuck.`,
        );
      }

      console.log("⏳ Seed lock is held by another process, waiting...");
      // Synchronous sleep to keep the loop simple (this is a CLI script)
      Bun.sleepSync(POLL_INTERVAL_MS);
    }
  }
}

function tryRemoveStaleLock(): void {
  try {
    const stat = statSync(LOCK_FILE);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > STALE_THRESHOLD_MS) {
      console.warn(
        `⚠️  Stale lock detected (age: ${Math.round(ageMs / 1000)}s > ${STALE_THRESHOLD_MS / 1000}s). ` +
        "Removing stale lock file...",
      );
      unlinkSync(LOCK_FILE);
    }
  } catch {
    // Lock file was removed between our check and stat — that's fine
  }
}

function releaseLock(fd: number): void {
  try {
    closeSync(fd);
  } catch {
    // fd may already be closed
  }
  try {
    unlinkSync(LOCK_FILE);
    console.log("🔓 Seed lock released.");
  } catch {
    // Lock file may already be removed
  }
}

/**
 * Ensure a TCP port is free before starting a server.
 * If occupied, kills the occupying process and waits briefly.
 */
export async function ensurePortFree(port: string | number): Promise<void> {
  const proc = Bun.spawn(["lsof", "-ti", `:${port}`], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const pids = (await new Response(proc.stdout).text()).trim();
  await proc.exited;

  if (!pids) return;

  const pidList = pids.split("\n").filter(Boolean);
  console.warn(
    `⚠️  Port ${port} occupied by PID ${pidList.join(", ")} — killing...`
  );

  for (const pid of pidList) {
    try {
      Bun.spawnSync(["kill", "-9", pid]);
    } catch {
      // Process may have already exited
    }
  }

  // Wait for port to be released
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log(`   Port ${port} is now free.`);
}
