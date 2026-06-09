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
  /** YYYY-MM, suitable for stable Map / sort keys. */
  key: string;
  /** Display label, e.g. "2026 年 3 月" */
  label: string;
  /** Visits within the month, sorted newest first. */
  visits: T[];
}

/**
 * Returns visits grouped by (year, month) of visitDate, newest month
 * first; visits inside each month are also newest first. Invalid dates
 * are dropped (would otherwise corrupt the key/sort).
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
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(visit);
    else buckets.set(key, [visit]);
  }

  // Sort visits inside each bucket: newest first.
  for (const list of buckets.values()) {
    list.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }

  // Sort buckets newest-month first.
  return Array.from(buckets.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      label: formatMonthLabel(key),
      visits: list,
    }));
}

/** "2026-03" → "2026 年 3 月". */
export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  if (!y || !m) return key;
  return `${y} 年 ${Number(m)} 月`;
}
