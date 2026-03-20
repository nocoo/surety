/**
 * HTTP client for the Cloudflare Worker D1 proxy.
 * Used by sqlite-proxy to forward SQL queries to D1 via the Worker.
 */

export type TargetDb = "production" | "api-e2e" | "ui-e2e" | "mcp-e2e";

export interface QueryResult {
  rows: Record<string, unknown>[];
  meta: {
    changes: number;
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface BatchResult {
  results: QueryResult[];
}

export class WorkerDbClient {
  private readonly workerUrl: string;
  private readonly sharedSecret: string;
  private readonly targetDb: TargetDb;

  constructor(workerUrl: string, sharedSecret: string, targetDb: TargetDb = "production") {
    // Strip trailing slash
    this.workerUrl = workerUrl.replace(/\/+$/, "");
    this.sharedSecret = sharedSecret;
    this.targetDb = targetDb;
  }

  /**
   * Execute a single prepared statement.
   */
  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const response = await fetch(`${this.workerUrl}/query`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new WorkerDbError(`Worker /query failed (${response.status}): ${body}`, response.status);
    }

    const data = (await response.json()) as {
      success: boolean;
      results: Record<string, unknown>[];
      meta: QueryResult["meta"];
      error?: string;
    };

    if (!data.success) {
      throw new WorkerDbError(`Worker /query error: ${data.error ?? "unknown"}`, response.status);
    }

    return { rows: data.results, meta: data.meta };
  }

  /**
   * Execute multiple prepared statements atomically (D1 batch).
   */
  async batch(
    statements: Array<{ sql: string; params?: unknown[] }>,
  ): Promise<QueryResult[]> {
    const response = await fetch(`${this.workerUrl}/batch`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ statements }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new WorkerDbError(`Worker /batch failed (${response.status}): ${body}`, response.status);
    }

    const data = (await response.json()) as {
      success: boolean;
      results: Array<{
        results: Record<string, unknown>[];
        meta: QueryResult["meta"];
      }>;
      error?: string;
    };

    if (!data.success) {
      throw new WorkerDbError(`Worker /batch error: ${data.error ?? "unknown"}`, response.status);
    }

    return data.results.map((r) => ({ rows: r.results, meta: r.meta }));
  }

  /**
   * Check Worker + D1 liveness.
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) return false;

      const data = (await response.json()) as { status: string };
      return data.status === "ok";
    } catch {
      return false;
    }
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.sharedSecret}`,
      "X-Target-DB": this.targetDb,
    };
  }
}

export class WorkerDbError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WorkerDbError";
  }
}
