import type { NewPayment } from "../schema";
import { formatLocalDate } from "./date-utils";

export interface GeneratePaymentsInput {
  policyId: number;
  /**
   * Period 1's dueDate — the contractual start of the schedule (typically
   * `policy.effectiveDate`). Used both as the period-numbering origin
   * (period 1 = this date) and as the lower bound: nothing earlier than
   * this is ever emitted.
   */
  firstDueDate: string;
  /**
   * Optional schedule anchor — the user-recorded "next premium due date"
   * (`policy.nextDueDate`). When provided, the dueDate progression is
   * computed around this date instead of marching forward from
   * `firstDueDate`, so user-side drift (e.g. mid-year billing alignment
   * 6/29 on a policy that took effect 12/29) is honored.
   *
   * Period numbering still anchors on `firstDueDate` — i.e. period 1's
   * dueDate is `firstDueDate`, and the anchored period gets numbered by
   * how many `paymentFrequency` steps separate it from `firstDueDate`.
   *
   * Past periods between `firstDueDate` and `anchorDate` are backfilled
   * as Pending so users with a long-running policy and no payment
   * history get the full picture (the typical "haven't touched this
   * policy in 4 years" case).
   *
   * When omitted (or equal to firstDueDate), behaviour is identical to
   * before: march forward from `firstDueDate`.
   */
  anchorDate?: string | null;
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

function parseLocalParts(dateStr: string): [number, number, number] {
  const [year, month, day] = dateStr.split("-").map(Number);
  return [year ?? 0, (month ?? 1) - 1, day ?? 1]; // month 0-indexed
}

/**
 * Compute the dueDate for period N (1-indexed) of a schedule anchored at
 * `(anchorYear, anchorMonth, anchorDay)`. Period 1 is the anchor itself;
 * each subsequent period offsets by `frequency` and clamps day-of-month
 * to the target month's last day (e.g. Jan 31 + 1 month → Feb 28/29).
 */
function periodDate(
  anchorYear: number,
  anchorMonth: number, // 0-indexed
  anchorDay: number,
  periodIndex: number, // 0 = anchor, 1 = +1 step, -1 = -1 step
  frequency: "Single" | "Monthly" | "Yearly",
): Date {
  let dueYear: number;
  let dueMonth: number;

  if (frequency === "Monthly") {
    // floorDiv to handle negative offsets correctly
    const totalMonths = anchorMonth + periodIndex;
    dueYear = anchorYear + Math.floor(totalMonths / 12);
    dueMonth = ((totalMonths % 12) + 12) % 12;
  } else if (frequency === "Yearly") {
    dueYear = anchorYear + periodIndex;
    dueMonth = anchorMonth;
  } else {
    // Single
    dueYear = anchorYear;
    dueMonth = anchorMonth;
  }

  const lastDayOfTargetMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
  const dueDay = Math.min(anchorDay, lastDayOfTargetMonth);
  return new Date(dueYear, dueMonth, dueDay);
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
  const { policyId, firstDueDate, paymentFrequency, premium } = input;
  const cutoffDate = options.cutoffDate ?? null;
  const existingPeriodNumbers = options.existingPeriodNumbers ?? new Set<number>();
  const markPastAsPaid = options.markPastAsPaid ?? false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Pick the schedule anchor. When the caller passes `anchorDate` (the
  // user-recorded next-due-date), drive period dueDates from there so
  // user-side billing-day drift is honored. Otherwise fall back to
  // `firstDueDate` (period 1's dueDate, conventionally effectiveDate).
  const anchorDateStr = input.anchorDate ?? firstDueDate;
  const [aYear, aMonth, aDay] = parseLocalParts(anchorDateStr);
  const [fYear, fMonth, fDay] = parseLocalParts(firstDueDate);
  const firstDueDateObj = new Date(fYear, fMonth, fDay);

  // Single payment policies have exactly one period at the anchor date.
  if (paymentFrequency === "Single") {
    const dueDate = periodDate(aYear, aMonth, aDay, 0, "Single");
    if (existingPeriodNumbers.has(1)) return [];
    if (cutoffDate !== null && dueDate > cutoffDate) return [];
    const dueDateStr = formatLocalDate(dueDate);
    const isPast = dueDate < today;
    const treatAsPaid = markPastAsPaid && isPast;
    return [{
      policyId,
      periodNumber: 1,
      dueDate: dueDateStr,
      amount: premium,
      status: treatAsPaid ? "Paid" : "Pending",
      paidDate: treatAsPaid ? dueDateStr : null,
      paidAmount: treatAsPaid ? premium : null,
    }];
  }

  // Recurring schedule: figure out which period number (relative to the
  // anchor) period 1 occupies. We walk backwards from the anchor and
  // count how many steps stay >= firstDueDate; that count + 1 (for the
  // anchor itself) is the anchor's period number.
  //
  // E.g. anchor 2026-06-29, firstDueDate 2022-12-29, Yearly:
  //   back=1: 2025-06-29 ≥ effective → count it
  //   back=2: 2024-06-29 ≥ effective → count it
  //   back=3: 2023-06-29 ≥ effective → count it
  //   back=4: 2022-06-29 < effective → stop
  //   anchorPeriodNumber = 3 + 1 = 4  (period 1 = 2023-06-29)
  let anchorPeriodNumber = 1;
  for (let back = 1; back < 10_000; back++) {
    const d = periodDate(aYear, aMonth, aDay, -back, paymentFrequency);
    if (d < firstDueDateObj) {
      anchorPeriodNumber = back; // back-1 steps were valid, +1 for anchor itself
      break;
    }
  }

  const maxPeriods =
    input.totalPayments ?? (cutoffDate !== null ? 1200 : 1);

  // Enumerate every period number from 1 .. maxPeriods, compute its
  // dueDate by offsetting from anchor, apply cutoff + idempotency.
  const records: NewPayment[] = [];
  for (let periodNumber = 1; periodNumber <= maxPeriods; periodNumber++) {
    const offsetFromAnchor = periodNumber - anchorPeriodNumber;
    const dueDate = periodDate(
      aYear,
      aMonth,
      aDay,
      offsetFromAnchor,
      paymentFrequency,
    );

    if (dueDate < firstDueDateObj) continue; // safety: stay >= firstDueDate
    if (cutoffDate !== null && dueDate > cutoffDate) break;
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
