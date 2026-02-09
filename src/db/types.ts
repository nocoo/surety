export type Relation = "Self" | "Spouse" | "Child" | "Parent";
export type Gender = "M" | "F";
export type AssetType = "RealEstate" | "Vehicle";
export type InsuredType = "Member" | "Asset";
export type PolicyCategory =
  | "Life"
  | "CriticalIllness"
  | "Medical"
  | "Accident"
  | "Annuity"
  | "Property";
export type PaymentFrequency = "Single" | "Monthly" | "Yearly";
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
    const expiry = new Date(expiryDate);
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
export type PaymentStatus = "Pending" | "Paid" | "Overdue";
