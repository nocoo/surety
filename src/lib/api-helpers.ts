/**
 * API helper functions for request-scoped database access.
 */
import { getDbForRequest, createBatchExecutor, resolveTargetDb, type DbInstance, type TargetDb } from "@/db/index";
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
  targetDb: TargetDb;
  batchExecute?: BatchExecuteFn;
}> {
  let cookieValue: string | undefined;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("surety-database")?.value;
  } catch {
    // Outside Next.js context (e.g., tests) — use defaults
  }

  // Validate cookie through resolveTargetDb (sanitizes invalid values to "production")
  const targetDb = resolveTargetDb(cookieValue);

  const db = getDbForRequest(targetDb);
  const repos = createAllRepos(db);
  const batchExecute = createBatchExecutor(targetDb);
  return batchExecute ? { db, repos, targetDb, batchExecute } : { db, repos, targetDb };
}

