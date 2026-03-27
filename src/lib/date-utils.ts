/**
 * Parse a "YYYY-MM-DD" date string into a local-timezone Date at midnight.
 * Using manual parsing avoids the browser's new Date("YYYY-MM-DD") behavior
 * which produces UTC midnight — that shifts to the previous day in UTC-west
 * timezones (e.g. America/Los_Angeles).
 */
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  return new Date(year, month, day);
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
