/**
 * Visit grouping utilities for the timeline view.
 *
 * Lives in apps/web/src/lib because the page can't be tested directly
 * (it's a full React tree with App-shell + SWR + DOM), but the bucketing
 * logic is pure and worth a regression net — visits with weird dates
 * (legacy non-ISO, future visits, undefined) showed up in production.
 */

export interface VisitForGrouping {
  id: number;
  visitDate: string;
}

export interface MonthBucket<T> {
  /** YYYY-MM, suitable for stable Map / sort keys. The literal string
   *  "unknown" is used for the catch-all bucket of visits whose
   *  visitDate is unparseable; it sorts last. */
  key: string;
  /** Display label, e.g. "2026 年 3 月" or "日期未识别" */
  label: string;
  /** Visits within the month, sorted newest first. */
  visits: T[];
}

/** Sentinel key for visits whose visitDate is missing or unparseable. */
export const UNKNOWN_DATE_KEY = "unknown";

/**
 * Returns visits grouped by (year, month) of visitDate, newest month
 * first; visits inside each month are also newest first. Visits whose
 * visitDate fails to parse go into a trailing "日期未识别" bucket
 * instead of being silently dropped — so the user can still see the
 * record exists and edit it (the previous behaviour caused records
 * with legacy date formats to disappear from the timeline view).
 *
 * Parsing `visitDate` via the Date constructor: the API stores ISO
 * `YYYY-MM-DD`, so the constructor is fine and avoids a timezone-aware
 * parser dependency. New Date("2026-03-15") is UTC-midnight, which is
 * the same calendar month everywhere east of UTC-12 — safe for CN users.
 */
export function groupVisitsByMonth<T extends VisitForGrouping>(
  visits: readonly T[],
): MonthBucket<T>[] {
  const buckets = new Map<string, T[]>();

  for (const visit of visits) {
    const d = new Date(visit.visitDate);
    const key = Number.isNaN(d.getTime())
      ? UNKNOWN_DATE_KEY
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(visit);
    else buckets.set(key, [visit]);
  }

  // Sort visits inside each bucket: newest first. The unknown bucket
  // gets the same lexicographic sort by raw string — not strictly
  // chronological but stable.
  for (const list of buckets.values()) {
    list.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }

  // Sort buckets newest-month first; unknown sentinel always trails.
  return Array.from(buckets.entries())
    .sort(([a], [b]) => {
      if (a === UNKNOWN_DATE_KEY) return 1;
      if (b === UNKNOWN_DATE_KEY) return -1;
      return b.localeCompare(a);
    })
    .map(([key, list]) => ({
      key,
      label: formatMonthLabel(key),
      visits: list,
    }));
}

/** "2026-03" → "2026 年 3 月"; UNKNOWN_DATE_KEY → "日期未识别". */
export function formatMonthLabel(key: string): string {
  if (key === UNKNOWN_DATE_KEY) return "日期未识别";
  const [y, m] = key.split("-");
  if (!y || !m) return key;
  return `${y} 年 ${Number(m)} 月`;
}

/**
 * Format a visit date as `YYYY-MM-DD`. If the input is missing or
 * unparseable, returns the same "日期未识别" string used by the
 * timeline's unknown-date bucket — never `NaN-NaN-NaN`, which would
 * leak through from `new Date("garbage")`.
 */
export function formatVisitDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "日期未识别";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "日期未识别";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
