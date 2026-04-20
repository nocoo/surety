/**
 * API helper functions for request-scoped database access.
 */
import { getDbForRequest, createBatchExecutor, resolveTargetDb, type DbInstance, type TargetDb } from "@/db/index";
import { createAllRepos, type AllRepos } from "@/db/repositories";
import type { BatchExecuteFn } from "@/db/backup";
import type { Session } from "next-auth";
import { auth } from "@/auth";

/** E2E test mode flag */
const E2E_SKIP_AUTH = process.env.E2E_SKIP_AUTH === "true";

/** Test email used in E2E mode */
const E2E_TEST_EMAIL = "e2e-test@example.com";

/**
 * Get session for API routes, with E2E test mode support.
 * In E2E mode (E2E_SKIP_AUTH=true), returns a mock session.
 * In normal mode, delegates to NextAuth's auth().
 */
export async function getSessionForApi(): Promise<Session | null> {
  if (E2E_SKIP_AUTH) {
    // Return mock session for E2E tests
    return {
      user: {
        email: E2E_TEST_EMAIL,
        name: "E2E Test User",
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return auth();
}

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

