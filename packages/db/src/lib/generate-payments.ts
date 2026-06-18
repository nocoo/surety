import type { NewPayment } from "../schema";
import { formatLocalDate } from "./date-utils";

export interface GeneratePaymentsInput {
  policyId: number;
  effectiveDate: string; // ISO date string (YYYY-MM-DD)
  paymentFrequency: "Single" | "Monthly" | "Yearly";
  totalPayments: number | null; // null → 1 for Single
  premium: number;
}

export interface GeneratePaymentsOptions {
  /**
   * When set, only generate records with dueDate <= cutoffDate.
   * When null/undefined, generate all periods up to totalPayments.
   */
  cutoffDate?: Date | null;

  /** Period numbers already in DB; skipped for idempotency. */
  existingPeriodNumbers?: Set<number>;

  /**
   * Seed mode flag: when true, periods whose dueDate is strictly before today
   * are emitted with status="Paid" + paidDate/paidAmount populated. When false
   * (default), every generated record is "Pending" with no paid fields.
   *
   * The user-facing "generate" button uses false so the user manually marks
   * what was actually paid. Demo seed uses true so historical periods look
   * realistic without manual work.
   */
  markPastAsPaid?: boolean;
}

/**
 * Generate payment records for a policy.
 *
 * @returns Array of NewPayment records ready for DB insertion.
 */
export function generatePaymentRecords(
  input: GeneratePaymentsInput,
  options: GeneratePaymentsOptions = {},
): NewPayment[] {
  const { policyId, effectiveDate, paymentFrequency, premium } = input;
  const cutoffDate = options.cutoffDate ?? null;
  const existingPeriodNumbers = options.existingPeriodNumbers ?? new Set<number>();
  const markPastAsPaid = options.markPastAsPaid ?? false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine the upper bound on number of periods:
  // - Single: always 1
  // - totalPayments provided: use it
  // - totalPayments null + cutoff: generate until cutoff, cap at 1200 (100 years monthly)
  // - totalPayments null + no cutoff: only 1 (can't determine how many periods)
  const maxPeriods =
    paymentFrequency === "Single"
      ? 1
      : input.totalPayments ?? (cutoffDate !== null ? 1200 : 1);

  const records: NewPayment[] = [];

  // Parse start date as local (YYYY-MM-DD) — hoist outside the loop.
  const [year, month, day] = effectiveDate.split("-").map(Number);
  const startYear = year ?? 0;
  const startMonth = (month ?? 1) - 1; // JS months are 0-indexed
  const startDay = day ?? 1;

  for (let i = 0; i < maxPeriods; i++) {
    const periodNumber = i + 1;

    let dueYear: number;
    let dueMonth: number; // 0-indexed

    if (paymentFrequency === "Monthly") {
      dueYear = startYear + Math.floor((startMonth + i) / 12);
      dueMonth = (startMonth + i) % 12;
    } else if (paymentFrequency === "Yearly") {
      dueYear = startYear + i;
      dueMonth = startMonth;
    } else {
      // Single: use effectiveDate as-is
      dueYear = startYear;
      dueMonth = startMonth;
    }

    // Clamp day to the last day of the target month
    // E.g., Jan 31 + 1 month → Feb 28/29, Feb 29 + 1 year → Feb 28 (non-leap)
    const lastDayOfTargetMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
    const dueDay = Math.min(startDay, lastDayOfTargetMonth);

    const dueDate = new Date(dueYear, dueMonth, dueDay);

    // Cutoff: stop generating beyond the cutoff date
    if (cutoffDate !== null && dueDate > cutoffDate) break;

    // Skip already-existing periods (idempotency)
    if (existingPeriodNumbers.has(periodNumber)) continue;

    const dueDateStr = formatLocalDate(dueDate);
    const isPast = dueDate < today;
    const treatAsPaid = markPastAsPaid && isPast;

    records.push({
      policyId,
      periodNumber,
      dueDate: dueDateStr,
      amount: premium,
      status: treatAsPaid ? "Paid" : "Pending",
      paidDate: treatAsPaid ? dueDateStr : null,
      paidAmount: treatAsPaid ? premium : null,
    });
  }

  return records;
}
