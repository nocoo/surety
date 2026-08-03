/**
 * Visit grouping utilities for the timeline view.
 *
 * Lives in apps/web/src/lib because the page can't be tested directly
 * (it's a full React tree with App-shell + SWR + DOM), but the bucketing
 * logic is pure and worth a regression net — visits with weird dates
 * (legacy non-ISO, future visits, undefined) showed up in production.
 */

import { formatLocalDate, parseLocalDate } from "@surety/db/lib/date-utils";

export interface VisitForGrouping {
	id: number;
	visitDate: string;
}

/** Strict calendar-date shape used by the API (`YYYY-MM-DD`). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a visit/birth date string as a **local** calendar day.
 *
 * Never use `new Date("YYYY-MM-DD")` here — that is UTC midnight and
 * shifts to the previous local day in western timezones (Codex P1).
 * Round-trip via formatLocalDate rejects overflow like 2026-02-31.
 */
export function parseVisitLocalDate(dateStr: string | null | undefined): Date | null {
	if (!dateStr || !ISO_DATE_RE.test(dateStr)) return null;
	const d = parseLocalDate(dateStr);
	if (Number.isNaN(d.getTime())) return null;
	if (formatLocalDate(d) !== dateStr) return null;
	return d;
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
 * Month keys use local calendar components from parseVisitLocalDate
 * so western timezones don't shift YYYY-MM-DD into the prior month.
 */
export function groupVisitsByMonth<T extends VisitForGrouping>(
	visits: readonly T[],
): MonthBucket<T>[] {
	const buckets = new Map<string, T[]>();

	for (const visit of visits) {
		const d = parseVisitLocalDate(visit.visitDate);
		const key = d
			? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
			: UNKNOWN_DATE_KEY;
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
 * timeline's unknown-date bucket — never `NaN-NaN-NaN`.
 */
export function formatVisitDate(dateStr: string | null | undefined): string {
	const d = parseVisitLocalDate(dateStr);
	if (!d) return "日期未识别";
	return formatLocalDate(d);
}

/**
 * Days between today (local midnight) and the given visit date. Positive
 * for past, negative for future, 0 for today. Returns `null` for missing
 * or unparseable input — `formatDaysAgo` then renders the `-` placeholder
 * instead of letting `NaN年前` reach the user.
 */
export function calculateDaysAgo(dateStr: string | null | undefined): number | null {
	const visitDate = parseVisitLocalDate(dateStr);
	if (!visitDate) return null;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	visitDate.setHours(0, 0, 0, 0);
	return Math.floor((today.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Months elapsed between a birth date and a visit date. Returns `null`
 * if either input is missing/unparseable so the caller can render a
 * placeholder instead of `NaN岁NaN月`.
 */
export function calculateAgeInMonths(
	birthDateStr: string | null | undefined,
	visitDateStr: string | null | undefined,
): number | null {
	const birthDate = parseVisitLocalDate(birthDateStr);
	const visitDate = parseVisitLocalDate(visitDateStr);
	if (!birthDate || !visitDate) return null;
	return (
		(visitDate.getFullYear() - birthDate.getFullYear()) * 12 +
		(visitDate.getMonth() - birthDate.getMonth())
	);
}

/** Render months-of-age as e.g. "8月龄" / "3岁" / "3岁2月". `null`/negative → "-". */
export function formatAgeInMonths(months: number | null): string {
	if (months === null) return "-";
	if (months < 0) return "-";
	if (months < 12) return `${months}月龄`;
	const years = Math.floor(months / 12);
	const remainingMonths = months % 12;
	if (remainingMonths === 0) return `${years}岁`;
	return `${years}岁${remainingMonths}月`;
}

/** Render days-ago / days-from-now in CN-friendly units. `null` → "-".
 *  Future phrasing uses "还有 N …" (todo tone) rather than "N天后". */
export function formatDaysAgo(days: number | null): string {
	if (days === null) return "-";
	if (days === 0) return "今天";
	if (days === 1) return "昨天";
	if (days === -1) return "明天";
	if (days < 0) {
		const abs = -days;
		if (abs < 7) return `还有 ${abs} 天`;
		if (abs < 30) return `还有 ${Math.floor(abs / 7)} 周`;
		if (abs < 365) return `还有 ${Math.floor(abs / 30)} 个月`;
		return `还有 ${Math.floor(abs / 365)} 年`;
	}
	if (days < 7) return `${days}天前`;
	if (days < 30) return `${Math.floor(days / 7)}周前`;
	if (days < 365) return `${Math.floor(days / 30)}月前`;
	return `${Math.floor(days / 365)}年前`;
}

/** Relative position of a visit date vs local today. */
export type VisitTemporal = "upcoming" | "today" | "past" | "unknown";

/**
 * Classify a visit date against local midnight today.
 * Invalid / missing dates are "unknown" so callers can still surface them.
 */
export function getVisitTemporal(dateStr: string | null | undefined): VisitTemporal {
	const days = calculateDaysAgo(dateStr);
	if (days === null) return "unknown";
	if (days < 0) return "upcoming";
	if (days === 0) return "today";
	return "past";
}

export interface TemporalPartition<T> {
	/** Future visits, soonest first. */
	upcoming: T[];
	/** Visits dated today. */
	today: T[];
	/** Past visits, most recent first. */
	past: T[];
	/** Unparseable visitDate — kept so records are never silently dropped. */
	unknown: T[];
}

/**
 * Split visits into upcoming / today / past / unknown.
 * Sort policy A: upcoming ascending (handle nearest first), past descending.
 */
export function partitionVisitsByTemporal<T extends VisitForGrouping>(
	visits: readonly T[],
): TemporalPartition<T> {
	const upcoming: T[] = [];
	const today: T[] = [];
	const past: T[] = [];
	const unknown: T[] = [];

	for (const visit of visits) {
		const temporal = getVisitTemporal(visit.visitDate);
		if (temporal === "upcoming") upcoming.push(visit);
		else if (temporal === "today") today.push(visit);
		else if (temporal === "past") past.push(visit);
		else unknown.push(visit);
	}

	upcoming.sort((a, b) => a.visitDate.localeCompare(b.visitDate));
	past.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
	// today / unknown: stable by date string (today all equal; unknown may vary)
	today.sort((a, b) => a.visitDate.localeCompare(b.visitDate));
	unknown.sort((a, b) => a.visitDate.localeCompare(b.visitDate));

	return { upcoming, today, past, unknown };
}

/**
 * Chip filter on the medical-visits page.
 * - all: everything
 * - upcoming: 待就诊 = future + today
 * - past: 已发生
 */
export type TemporalFilter = "all" | "upcoming" | "past";

/** Apply a temporal chip filter. Unknown dates only appear under "all". */
export function filterVisitsByTemporal<T extends VisitForGrouping>(
	visits: readonly T[],
	filter: TemporalFilter,
): T[] {
	if (filter === "all") return visits.slice();
	return visits.filter((v) => {
		const t = getVisitTemporal(v.visitDate);
		if (filter === "upcoming") return t === "upcoming" || t === "today";
		return t === "past";
	});
}

export interface TemporalCounts {
	all: number;
	/** upcoming + today (待就诊 chip) */
	upcoming: number;
	past: number;
}

export function countVisitsByTemporal<T extends VisitForGrouping>(
	visits: readonly T[],
): TemporalCounts {
	const p = partitionVisitsByTemporal(visits);
	return {
		all: visits.length,
		upcoming: p.upcoming.length + p.today.length,
		past: p.past.length,
	};
}

/**
 * Month-bucket upcoming visits with soonest-first order (opposite of the
 * default newest-first grouping used for the past archive).
 */
export function groupUpcomingVisitsByMonth<T extends VisitForGrouping>(
	visits: readonly T[],
): MonthBucket<T>[] {
	return groupVisitsByMonth(visits)
		.reverse()
		.map((bucket) => ({
			...bucket,
			visits: [...bucket.visits].reverse(),
		}));
}

/** Status badge for temporal state. Past/unknown → null (no badge noise). */
export function getTemporalBadge(
	temporal: VisitTemporal,
): { label: string; variant: "info" | "warning" } | null {
	if (temporal === "upcoming") return { label: "待就诊", variant: "info" };
	if (temporal === "today") return { label: "今天", variant: "warning" };
	return null;
}
