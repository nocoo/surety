import type { NewPayment } from "@/db/schema";

export interface GeneratePaymentsInput {
  policyId: number;
  effectiveDate: string; // ISO date string (YYYY-MM-DD)
  paymentFrequency: "Single" | "Monthly" | "Yearly";
  totalPayments: number | null; // null → 1 for Single
  premium: number;
}

/**
 * Generate payment records for a policy.
 *
 * @param input - Policy payment parameters
 * @param cutoffDate - When non-null, only generate records with dueDate <= cutoffDate.
 *                     When null, generate all periods (seed mode).
 * @param existingPeriodNumbers - Period numbers that already exist; skipped for idempotency.
 * @returns Array of NewPayment records ready for DB insertion.
 */
export function generatePaymentRecords(
  input: GeneratePaymentsInput,
  cutoffDate: Date | null,
  existingPeriodNumbers: Set<number>,
): NewPayment[] {
  const { policyId, effectiveDate, paymentFrequency, premium } = input;
  const startDate = new Date(effectiveDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine the upper bound on number of periods:
  // - Single: always 1
  // - totalPayments provided: use it
  // - totalPayments null (open-ended): generate until cutoff, cap at 1200 (100 years monthly)
  const maxPeriods =
    paymentFrequency === "Single"
      ? 1
      : input.totalPayments ?? (cutoffDate !== null ? 1200 : 1);

  const records: NewPayment[] = [];

  for (let i = 0; i < maxPeriods; i++) {
    const periodNumber = i + 1;

    const dueDate = new Date(startDate);
    if (paymentFrequency === "Monthly") {
      dueDate.setMonth(dueDate.getMonth() + i);
    } else if (paymentFrequency === "Yearly") {
      dueDate.setFullYear(dueDate.getFullYear() + i);
    }
    // Single: dueDate stays at effectiveDate

    // Cutoff: stop generating beyond the cutoff date
    if (cutoffDate !== null && dueDate > cutoffDate) break;

    // Skip already-existing periods (idempotency)
    if (existingPeriodNumbers.has(periodNumber)) continue;

    const dueDateStr = dueDate.toISOString().split("T")[0] ?? "";
    const isPast = dueDate < today;

    records.push({
      policyId,
      periodNumber,
      dueDate: dueDateStr,
      amount: premium,
      status: isPast ? "Paid" : "Pending",
      paidDate: isPast ? dueDateStr : null,
      paidAmount: isPast ? premium : null,
    });
  }

  return records;
}
