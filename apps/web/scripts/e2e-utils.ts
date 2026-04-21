/**
 * Shared E2E utilities for test runner scripts.
 */

import { openSync, closeSync, unlinkSync, statSync } from "fs";

const LOCK_FILE = "/tmp/surety-e2e.lock";
const LOCK_TIMEOUT_MS = 120_000; // 2 min wait for another runner to finish
const POLL_INTERVAL_MS = 1_000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min — a full E2E run can take several minutes

// ---------------------------------------------------------------------------
// E2E Lock — protects the entire E2E lifecycle (seed + server + test execution)
//
// All E2E suites share a single remote D1 dev database. The lock ensures
// only one runner operates on the database at a time, preventing:
//   - Runner B's seed from clearing Runner A's data mid-test
//   - Concurrent INSERTs causing unique constraint violations
// ---------------------------------------------------------------------------

/**
 * Execute `fn` while holding an exclusive file lock that covers
 * the entire E2E lifecycle (seed + test execution).
 *
 * - Uses `openSync(path, 'wx')` (exclusive create) as the lock primitive
 * - Polls if lock is held, up to LOCK_TIMEOUT_MS
 * - Stale lock detection: if lockfile age > 10 min, force-removes it
 */
export async function withE2eLock<T>(fn: () => Promise<T>): Promise<T> {
  const fd = acquireE2eLock();
  try {
    return await fn();
  } finally {
    releaseE2eLock(fd);
  }
}

/**
 * Acquire the E2E lock manually. Returns a file descriptor that must be
 * passed to `releaseE2eLock()`. Use this in test files where beforeAll/afterAll
 * need separate acquire/release calls.
 */
export function acquireE2eLock(): number {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      // 'wx' = O_WRONLY | O_CREAT | O_EXCL — fails if file exists
      const fd = openSync(LOCK_FILE, "wx");
      console.log("🔒 E2E lock acquired.");
      return fd;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        throw err; // Unexpected error (permissions, etc.)
      }

      // Lock file exists — check for staleness
      tryRemoveStaleLock();

      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out waiting for E2E lock (${LOCK_TIMEOUT_MS / 1000}s). ` +
          `Lock file: ${LOCK_FILE}. Another E2E runner may be stuck.`,
        );
      }

      console.log("⏳ E2E lock is held by another runner, waiting...");
      // Synchronous sleep to keep the loop simple (this is a CLI script)
      Bun.sleepSync(POLL_INTERVAL_MS);
    }
  }
}

/**
 * Release the E2E lock. Must be called with the fd returned by `acquireE2eLock()`.
 */
export function releaseE2eLock(fd: number): void {
  try {
    closeSync(fd);
  } catch {
    // fd may already be closed
  }
  try {
    unlinkSync(LOCK_FILE);
    console.log("🔓 E2E lock released.");
  } catch {
    // Lock file may already be removed
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
