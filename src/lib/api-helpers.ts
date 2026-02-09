/**
 * API helper functions for ensuring correct database connection.
 */
import { cookies } from "next/headers";
import { ensureDatabaseFromCookie } from "@/db/index";

/**
 * Ensure the database connection matches the user's cookie setting.
 * Call this at the start of every API route handler.
 */
export async function ensureDbFromRequest(): Promise<void> {
  const cookieStore = await cookies();
  ensureDatabaseFromCookie(cookieStore.get("surety-database")?.value);
}
