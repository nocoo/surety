/**
 * API helper functions for request-scoped database access.
 */
import { getDbForRequest, type DbInstance } from "@/db/index";
import { createAllRepos, type AllRepos } from "@/db/repositories";

/**
 * Get request-scoped database and repos from cookie.
 * Reads surety-database cookie from next/headers.
 *
 * Note: This uses dynamic import of next/headers to avoid
 * breaking unit tests that don't run in Next.js context.
 */
export async function getReposFromRequest(): Promise<{ db: DbInstance; repos: AllRepos }> {
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
  return { db, repos };
}

