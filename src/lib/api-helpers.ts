/**
 * API helper functions for request-scoped database access.
 */
import { getDbForRequest, createBatchExecutor, type DbInstance } from "@/db/index";
import { createAllRepos, type AllRepos } from "@/db/repositories";
import type { BatchExecuteFn } from "@/db/backup";

/**
 * Get request-scoped database and repos from cookie.
 * Reads surety-database cookie from next/headers.
 *
 * Note: This uses dynamic import of next/headers to avoid
 * breaking unit tests that don't run in Next.js context.
 */
export async function getReposFromRequest(): Promise<{
  db: DbInstance;
  repos: AllRepos;
  batchExecute?: BatchExecuteFn;
}> {
  let targetDb: string | undefined;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    targetDb = cookieStore.get("surety-database")?.value;
  } catch {
    // Outside Next.js context (e.g., tests) — use defaults
  }

  const db = getDbForRequest(targetDb as Parameters<typeof getDbForRequest>[0]);
  const repos = createAllRepos(db);
  const batchExecute = createBatchExecutor(targetDb as Parameters<typeof createBatchExecutor>[0]);
  return batchExecute ? { db, repos, batchExecute } : { db, repos };
}

