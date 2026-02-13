/**
 * Lightweight health-check logic.
 *
 * Designed to be called very frequently by external monitors.
 * Must stay fast — no heavy queries, no side-effects.
 */

export interface HealthResult {
  status: "ok" | "error";
  timestamp: string;
  uptime: number;
  database: { connected: boolean; error?: string };
  runtime: string;
  version: string;
  memoryMB: number;
}

export interface HealthDeps {
  /** Return the raw SQLite driver (may throw if no connection) */
  getRawSqlite: () => { prepare: (sql: string) => { get: () => unknown } };
  /** process.uptime() in seconds */
  uptime: number;
  /** Runtime identifier, e.g. "bun" or "node" */
  runtime: string;
  /** App version string */
  version: string;
  /** Resident-set size in bytes (process.memoryUsage().rss) */
  rssBytes: number;
}

/**
 * Probe system health. Pure function — all I/O is injected via `deps`.
 *
 * Error messages intentionally avoid the word "ok" so keyword-based
 * monitors do not produce false positives.
 */
export function checkHealth(deps: HealthDeps): HealthResult {
  const base = {
    timestamp: new Date().toISOString(),
    uptime: Math.round(deps.uptime),
    runtime: deps.runtime,
    version: deps.version,
    memoryMB: Math.round(deps.rssBytes / 1024 / 1024),
  };

  // --- database probe (lightweight SELECT 1) ---
  try {
    const sqlite = deps.getRawSqlite();
    const row = sqlite.prepare("SELECT 1 AS alive").get();
    if (!row) {
      return {
        ...base,
        status: "error",
        database: { connected: false, error: "empty result from probe query" },
      };
    }
    return {
      ...base,
      status: "ok",
      database: { connected: true },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "unknown database failure";
    // Sanitise: never leak "ok" into an error response
    const safeMessage = message.replace(/\bok\b/gi, "***");
    return {
      ...base,
      status: "error",
      database: { connected: false, error: safeMessage },
    };
  }
}
