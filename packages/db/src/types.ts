import { parseLocalDate } from "./lib/date-utils";

export type PolicyCategory =
  | "Life"
  | "WholeLife"
  | "CriticalIllness"
  | "Medical"
  | "Accident"
  | "Annuity"
  | "Property";
export type PolicyDbStatus = "Active" | "Lapsed" | "Surrendered" | "Claimed";
export type PolicyStatus = PolicyDbStatus | "Expired";

/**
 * Derive the display status from the DB status and expiry date.
 * When a policy is Active in DB but its expiryDate has passed, display as Expired.
 * This is a pure presentation concern — DB value is never mutated.
 */
export function deriveDisplayStatus(
  dbStatus: PolicyDbStatus,
  expiryDate: string | null,
  now: Date = new Date(),
): PolicyStatus {
  if (dbStatus === "Active" && expiryDate) {
    const expiry = parseLocalDate(expiryDate);
    if (expiry < now) return "Expired";
  }
  return dbStatus;
}

/**
 * Check if a policy is effectively active (Active in DB and not expired).
 */
export function isEffectivelyActive(
  dbStatus: PolicyDbStatus,
  expiryDate: string | null,
  now: Date = new Date(),
): boolean {
  return deriveDisplayStatus(dbStatus, expiryDate, now) === "Active";
}
