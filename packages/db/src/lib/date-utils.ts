/**
 * Canonical date conversion utilities.
 *
 * All "YYYY-MM-DD" strings stored in the database are timezone-agnostic
 * calendar dates. These helpers ensure consistent local-timezone handling:
 *
 * - parseLocalDate():  "YYYY-MM-DD" → Date (local midnight)
 * - formatLocalDate(): Date → "YYYY-MM-DD" (using local year/month/day)
 *
 * ⚠️  NEVER use `new Date("YYYY-MM-DD")` — it parses as UTC midnight,
 *     which shifts to the previous calendar day in UTC-west timezones.
 * ⚠️  NEVER use `date.toISOString().split("T")[0]` — it outputs the UTC
 *     date, which shifts to the previous calendar day in UTC-east timezones.
 */

/**
 * Parse a "YYYY-MM-DD" date string into a local-timezone Date at midnight.
 *
 * Using manual year/month/day extraction avoids the browser's
 * `new Date("YYYY-MM-DD")` behavior which produces UTC midnight —
 * that shifts to the previous day in UTC-west timezones
 * (e.g. America/Los_Angeles) and can cause off-by-one errors.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  return new Date(year, month, day);
}

/**
 * Format a Date into a "YYYY-MM-DD" string using the local timezone.
 *
 * This is the inverse of `parseLocalDate()`. Uses `getFullYear()`,
 * `getMonth()`, `getDate()` which return local-timezone components,
 * unlike `toISOString()` which outputs UTC and can shift the date
 * in UTC-east timezones (e.g. Asia/Shanghai).
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as a "YYYY-MM-DD" string in the local timezone.
 */
export function todayStr(): string {
  return formatLocalDate(new Date());
}

/**
 * Get today's calendar date in the given IANA timezone as "YYYY-MM-DD".
 *
 * Workers/Node typically run in UTC, but the product semantics are based
 * on the user's local calendar (Asia/Shanghai by default). Using `new Date()`
 * + `getDate()` server-side would emit the UTC day and silently skip
 * the first ~8 hours of every CST day. This helper picks the calendar
 * day in the requested timezone via Intl.
 */
export function todayInTimeZone(timeZone = "Asia/Shanghai"): string {
  // 'en-CA' formats as YYYY-MM-DD; combined with timeZone it gives a
  // stable calendar date regardless of the host timezone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Get Dec 31 of the current year in the given IANA timezone as "YYYY-MM-DD".
 * Used as the cutoff when backfilling premium schedules — we generate all
 * periods up to the end of the current calendar year, including ones still
 * in the future, so users see what's coming this year without waiting.
 */
export function endOfYearInTimeZone(timeZone = "Asia/Shanghai"): string {
  const today = todayInTimeZone(timeZone);
  const yearStr = today.slice(0, 4);
  return `${yearStr}-12-31`;
}

/**
 * Calculate the number of days between a date and today.
 * Positive = future, negative = past.
 */
export function getDaysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format a "days from today" value into a human-readable Chinese string.
 *
 * - Past dates: "已过 X 天"
 * - Today: "今天"
 * - Future dates: "X 天后"
 */
export function formatDaysFromToday(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "今天";
  if (days < 0) return `${Math.abs(days)}天前`;
  return `${days}天后`;
}

/**
 * Format a date string with days-from-today annotation.
 * Returns the original date string plus a parenthesized annotation.
 *
 * Example: "2025-06-28 (365天前)" or "2026-06-27 (92天后)"
 */
export function formatDateWithDays(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const days = getDaysFromToday(dateStr);
  const annotation = formatDaysFromToday(days);
  if (!annotation) return dateStr;
  return `${dateStr} (${annotation})`;
}
