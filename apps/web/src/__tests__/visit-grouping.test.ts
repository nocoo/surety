import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	calculateAgeInMonths,
	calculateDaysAgo,
	countVisitsByTemporal,
	filterVisitsByTemporal,
	formatAgeInMonths,
	formatDaysAgo,
	formatMonthLabel,
	formatVisitDate,
	getTemporalBadge,
	getVisitTemporal,
	groupUpcomingVisitsByMonth,
	groupVisitsByMonth,
	parseVisitLocalDate,
	partitionVisitsByTemporal,
	UNKNOWN_DATE_KEY,
} from "@/lib/visit-grouping";

describe("groupVisitsByMonth", () => {
	it("returns empty list for no visits", () => {
		expect(groupVisitsByMonth([])).toEqual([]);
	});

	it("groups visits by year-month", () => {
		const visits = [
			{ id: 1, visitDate: "2026-03-05" },
			{ id: 2, visitDate: "2026-03-20" },
			{ id: 3, visitDate: "2026-04-01" },
		];
		const result = groupVisitsByMonth(visits);
		expect(result.map((b) => b.key)).toEqual(["2026-04", "2026-03"]);
		expect(result[1]?.visits.map((v) => v.id)).toEqual([2, 1]);
	});

	it("orders months newest first, visits-within-month newest first", () => {
		const visits = [
			{ id: 1, visitDate: "2025-12-01" },
			{ id: 2, visitDate: "2026-01-15" },
			{ id: 3, visitDate: "2026-01-02" },
			{ id: 4, visitDate: "2026-03-10" },
		];
		const result = groupVisitsByMonth(visits);
		expect(result.map((b) => b.key)).toEqual(["2026-03", "2026-01", "2025-12"]);
		expect(result[1]?.visits.map((v) => v.id)).toEqual([2, 3]);
	});

	it("collects visits with invalid dates into a trailing 'unknown' bucket", () => {
		const visits = [
			{ id: 1, visitDate: "2026-03-05" },
			{ id: 2, visitDate: "garbage" },
			{ id: 3, visitDate: "" },
		];
		const result = groupVisitsByMonth(visits);
		expect(result).toHaveLength(2);
		expect(result[0]?.key).toBe("2026-03");
		expect(result[1]?.key).toBe(UNKNOWN_DATE_KEY);
		expect(result[1]?.label).toBe("日期未识别");
		expect(result[1]?.visits.map((v) => v.id).sort()).toEqual([2, 3]);
	});

	it("returns a single unknown bucket when ALL visits have invalid dates", () => {
		// Regression: previously every visit was silently dropped, leaving
		// the timeline with an empty array even when records existed.
		const visits = [
			{ id: 1, visitDate: "garbage" },
			{ id: 2, visitDate: "" },
			{ id: 3, visitDate: "not-a-date" },
		];
		const result = groupVisitsByMonth(visits);
		expect(result).toHaveLength(1);
		expect(result[0]?.key).toBe(UNKNOWN_DATE_KEY);
		expect(result[0]?.visits).toHaveLength(3);
	});

	it("places the unknown bucket after all real months", () => {
		const visits = [
			{ id: 1, visitDate: "garbage" },
			{ id: 2, visitDate: "2026-03-05" },
			{ id: 3, visitDate: "2025-12-01" },
		];
		const result = groupVisitsByMonth(visits);
		expect(result.map((b) => b.key)).toEqual(["2026-03", "2025-12", UNKNOWN_DATE_KEY]);
	});

	it("zero-pads month in key for stable lexicographic sort", () => {
		const visits = [
			{ id: 1, visitDate: "2026-09-01" },
			{ id: 2, visitDate: "2026-10-01" },
		];
		const result = groupVisitsByMonth(visits);
		expect(result[0]?.key).toBe("2026-10");
		expect(result[1]?.key).toBe("2026-09");
	});
});

describe("formatMonthLabel", () => {
	it("formats key as Chinese year-month", () => {
		expect(formatMonthLabel("2026-03")).toBe("2026 年 3 月");
		expect(formatMonthLabel("2025-12")).toBe("2025 年 12 月");
	});

	it("formats UNKNOWN_DATE_KEY as a friendly label", () => {
		expect(formatMonthLabel(UNKNOWN_DATE_KEY)).toBe("日期未识别");
	});

	it("returns the key unchanged when malformed", () => {
		expect(formatMonthLabel("garbage")).toBe("garbage");
		expect(formatMonthLabel("")).toBe("");
	});
});

describe("parseVisitLocalDate / formatVisitDate", () => {
	it("parses YYYY-MM-DD as local midnight (not UTC)", () => {
		// Regression (Codex P1): `new Date("YYYY-MM-DD")` is UTC midnight and
		// becomes the previous local calendar day in western timezones.
		const d = parseVisitLocalDate("2026-06-15");
		expect(d).not.toBeNull();
		expect(d?.getFullYear()).toBe(2026);
		expect(d?.getMonth()).toBe(5);
		expect(d?.getDate()).toBe(15);
		expect(d?.getHours()).toBe(0);
	});

	it("rejects non-ISO and overflow calendar dates", () => {
		expect(parseVisitLocalDate("garbage")).toBeNull();
		expect(parseVisitLocalDate("2026-02-31")).toBeNull();
		expect(parseVisitLocalDate("2026-13-01")).toBeNull();
		expect(parseVisitLocalDate("")).toBeNull();
		expect(parseVisitLocalDate(null)).toBeNull();
	});

	it("formats ISO date as YYYY-MM-DD", () => {
		expect(formatVisitDate("2026-03-05")).toBe("2026-03-05");
		expect(formatVisitDate("2025-12-09")).toBe("2025-12-09");
	});

	it("zero-pads single-digit months and days", () => {
		// Verify the padStart matches the bucket-key pad so visit date
		// strings displayed in a card always align with the month header.
		expect(formatVisitDate("2026-01-05")).toBe("2026-01-05");
		expect(formatVisitDate("2026-09-09")).toBe("2026-09-09");
	});

	it("returns the unknown-date label for invalid input", () => {
		// Regression: previously `new Date("garbage")` produced
		// `NaN-NaN-NaN` in the rendered card under the unknown-date bucket.
		expect(formatVisitDate("garbage")).toBe("日期未识别");
		expect(formatVisitDate("not-a-date")).toBe("日期未识别");
		expect(formatVisitDate("")).toBe("日期未识别");
		expect(formatVisitDate(null)).toBe("日期未识别");
		expect(formatVisitDate(undefined)).toBe("日期未识别");
	});
});

// Tests for relative-date helpers — fake the clock so "today" is stable.
// Using a date in the middle of the year so day/week/month arithmetic
// can be checked without month-boundary noise.
describe("calculateDaysAgo / formatDaysAgo", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns positive days for past dates", () => {
		expect(calculateDaysAgo("2026-06-10")).toBe(5);
		expect(calculateDaysAgo("2026-05-15")).toBe(31);
	});

	it("returns 0 for today and -1 for tomorrow", () => {
		expect(calculateDaysAgo("2026-06-15")).toBe(0);
		expect(calculateDaysAgo("2026-06-16")).toBe(-1);
	});

	it("returns null for missing or invalid input", () => {
		// Regression: previously the page rendered "NaN年前" for any record
		// with a malformed visitDate that survived into the table view.
		expect(calculateDaysAgo("garbage")).toBeNull();
		expect(calculateDaysAgo("")).toBeNull();
		expect(calculateDaysAgo(null)).toBeNull();
		expect(calculateDaysAgo(undefined)).toBeNull();
	});

	it("formatDaysAgo handles null and the boundary buckets", () => {
		expect(formatDaysAgo(null)).toBe("-");
		expect(formatDaysAgo(0)).toBe("今天");
		expect(formatDaysAgo(1)).toBe("昨天");
		expect(formatDaysAgo(-1)).toBe("明天");
		expect(formatDaysAgo(5)).toBe("5天前");
		expect(formatDaysAgo(10)).toBe("10天前");
		expect(formatDaysAgo(13)).toBe("13天前");
		expect(formatDaysAgo(14)).toBe("2周前");
		expect(formatDaysAgo(60)).toBe("2月前");
		expect(formatDaysAgo(800)).toBe("2年前");
		// Future uses todo-tone "还有 N …" rather than "N天后"
		expect(formatDaysAgo(-3)).toBe("还有 3 天");
		expect(formatDaysAgo(-10)).toBe("还有 10 天");
		expect(formatDaysAgo(-13)).toBe("还有 13 天");
		expect(formatDaysAgo(-14)).toBe("还有 2 周");
		expect(formatDaysAgo(-60)).toBe("还有 2 个月");
		expect(formatDaysAgo(-800)).toBe("还有 2 年");
	});
});

describe("getVisitTemporal / partitionVisitsByTemporal", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("classifies dates relative to today", () => {
		expect(getVisitTemporal("2026-06-20")).toBe("upcoming");
		expect(getVisitTemporal("2026-06-15")).toBe("today");
		expect(getVisitTemporal("2026-06-01")).toBe("past");
		expect(getVisitTemporal("garbage")).toBe("unknown");
		expect(getVisitTemporal(null)).toBe("unknown");
	});

	it("partitions with upcoming ascending and past descending", () => {
		const visits = [
			{ id: 1, visitDate: "2026-06-01" },
			{ id: 2, visitDate: "2026-06-20" },
			{ id: 3, visitDate: "2026-06-15" },
			{ id: 4, visitDate: "2026-07-01" },
			{ id: 5, visitDate: "2026-05-01" },
			{ id: 6, visitDate: "garbage" },
		];
		const p = partitionVisitsByTemporal(visits);
		expect(p.upcoming.map((v) => v.id)).toEqual([2, 4]); // soonest first
		expect(p.today.map((v) => v.id)).toEqual([3]);
		expect(p.past.map((v) => v.id)).toEqual([1, 5]); // most recent first
		expect(p.unknown.map((v) => v.id)).toEqual([6]);
	});

	it("filterVisitsByTemporal maps chips correctly", () => {
		const visits = [
			{ id: 1, visitDate: "2026-06-01" },
			{ id: 2, visitDate: "2026-06-20" },
			{ id: 3, visitDate: "2026-06-15" },
			{ id: 4, visitDate: "garbage" },
		];
		expect(
			filterVisitsByTemporal(visits, "all")
				.map((v) => v.id)
				.sort(),
		).toEqual([1, 2, 3, 4]);
		// 待就诊 = upcoming + today; unknown excluded
		expect(
			filterVisitsByTemporal(visits, "upcoming")
				.map((v) => v.id)
				.sort(),
		).toEqual([2, 3]);
		expect(filterVisitsByTemporal(visits, "past").map((v) => v.id)).toEqual([1]);
	});

	it("countVisitsByTemporal rolls today into upcoming chip count", () => {
		const visits = [
			{ id: 1, visitDate: "2026-06-01" },
			{ id: 2, visitDate: "2026-06-20" },
			{ id: 3, visitDate: "2026-06-15" },
			{ id: 4, visitDate: "garbage" },
		];
		expect(countVisitsByTemporal(visits)).toEqual({ all: 4, upcoming: 2, past: 1 });
	});

	it("groupUpcomingVisitsByMonth is soonest-first", () => {
		const visits = [
			{ id: 1, visitDate: "2026-08-10" },
			{ id: 2, visitDate: "2026-07-05" },
			{ id: 3, visitDate: "2026-07-20" },
		];
		const months = groupUpcomingVisitsByMonth(visits);
		expect(months.map((m) => m.key)).toEqual(["2026-07", "2026-08"]);
		expect(months[0]?.visits.map((v) => v.id)).toEqual([2, 3]); // within month ascending
	});

	it("getTemporalBadge only labels upcoming and today", () => {
		expect(getTemporalBadge("upcoming")).toEqual({ label: "待就诊", variant: "info" });
		expect(getTemporalBadge("today")).toEqual({ label: "今天", variant: "warning" });
		expect(getTemporalBadge("past")).toBeNull();
		expect(getTemporalBadge("unknown")).toBeNull();
	});
});

describe("calculateAgeInMonths / formatAgeInMonths", () => {
	it("returns null when birth date is missing", () => {
		expect(calculateAgeInMonths(null, "2026-06-15")).toBeNull();
		expect(calculateAgeInMonths(undefined, "2026-06-15")).toBeNull();
	});

	it("returns null when either date is invalid", () => {
		// Regression: previously the page rendered "NaN岁NaN月" when
		// visitDate was garbage and birthDate was valid.
		expect(calculateAgeInMonths("2020-01-01", "garbage")).toBeNull();
		expect(calculateAgeInMonths("garbage", "2026-06-15")).toBeNull();
		expect(calculateAgeInMonths("", "2026-06-15")).toBeNull();
	});

	it("computes months between two valid dates", () => {
		expect(calculateAgeInMonths("2026-01-01", "2026-06-15")).toBe(5);
		expect(calculateAgeInMonths("2020-06-01", "2026-06-01")).toBe(72);
	});

	it("formatAgeInMonths renders months / years / years-and-months", () => {
		expect(formatAgeInMonths(null)).toBe("-");
		expect(formatAgeInMonths(-1)).toBe("-");
		expect(formatAgeInMonths(0)).toBe("0月龄");
		expect(formatAgeInMonths(8)).toBe("8月龄");
		expect(formatAgeInMonths(12)).toBe("1岁");
		expect(formatAgeInMonths(14)).toBe("1岁2月");
		expect(formatAgeInMonths(36)).toBe("3岁");
	});
});
