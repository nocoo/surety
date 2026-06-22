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

export type TerminalPolicyStatus = "Surrendered" | "Claimed" | "Lapsed";

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

/**
 * Decide whether a payment row should be treated as obsoleted by a policy
 * termination event. Pure derivation — does not mutate the row. Returns true
 * only when the policy is in a terminal state (terminatedAt non-null), the
 * payment was never actually paid, and its dueDate falls strictly after
 * terminatedAt. Paid rows are real history and never filtered.
 */
export function isObsoletedByTermination(
  payment: { dueDate: string; status: "Pending" | "Paid" | "Overdue" },
  policyTerminatedAt: string | null,
): boolean {
  if (!policyTerminatedAt) return false;
  if (payment.status === "Paid") return false;
  return payment.dueDate > policyTerminatedAt;
}
