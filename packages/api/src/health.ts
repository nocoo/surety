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
  /** Probe database connectivity. Returns { connected: true } or { connected: false, error }. */
  probeDatabase: () => Promise<{ connected: boolean; error?: string }>;
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
export async function checkHealth(deps: HealthDeps): Promise<HealthResult> {
  const base = {
    timestamp: new Date().toISOString(),
    uptime: Math.round(deps.uptime),
    runtime: deps.runtime,
    version: deps.version,
    memoryMB: Math.round(deps.rssBytes / 1024 / 1024),
  };

  // --- database probe ---
  try {
    const probe = await deps.probeDatabase();
    if (!probe.connected) {
      const safeError = probe.error
        ? probe.error.replace(/\bok\b/gi, "***")
        : "database probe returned not connected";
      return {
        status: "error",
        ...base,
        database: { connected: false, error: safeError },
      };
    }
    return {
      status: "ok",
      ...base,
      database: { connected: true },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "unknown database failure";
    // Sanitise: never leak "ok" into an error response
    const safeMessage = message.replace(/\bok\b/gi, "***");
    return {
      status: "error",
      ...base,
      database: { connected: false, error: safeMessage },
    };
  }
}
