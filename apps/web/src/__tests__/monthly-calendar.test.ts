import { describe, expect, it } from "vitest";
import { __test__ } from "@/components/renewal/monthly-calendar";

const { buildMonthGrid, bucketEventsByDay, monthAccentClasses } = __test__;

describe("buildMonthGrid", () => {
	it("returns an empty array for malformed keys", () => {
		expect(buildMonthGrid("garbage")).toEqual([]);
		expect(buildMonthGrid("")).toEqual([]);
	});

	it("returns 35 cells for a 28-day month starting Monday (Feb 2027), Sunday-leading", () => {
		// 2027-02-01 is a Monday → Sunday-start grid has 1 leading blank → 1 + 28 = 29 → padded to 35
		const cells = buildMonthGrid("2027-02");
		expect(cells.length).toBe(35);
		expect(cells.length % 7).toBe(0);
		const realDays = cells.filter((c) => c.day !== null).length;
		expect(realDays).toBe(28);
		expect(cells[0]?.day).toBe(null);
		expect(cells[1]?.day).toBe(1);
		expect(cells[28]?.day).toBe(28);
	});

	it("places day 1 at the correct weekday slot (Sunday-start)", () => {
		// 2026-09-01 is a Tuesday → Sunday-start grid has 2 leading blanks → day 1 at index 2
		const cells = buildMonthGrid("2026-09");
		expect(cells[0]?.day).toBe(null);
		expect(cells[1]?.day).toBe(null);
		expect(cells[2]?.day).toBe(1);
	});

	it("pads to a multiple of 7 with trailing nulls", () => {
		const cells = buildMonthGrid("2026-03");
		expect(cells.length % 7).toBe(0);
		// Real days inside
		const realDays = cells.filter((c) => c.day !== null);
		expect(realDays).toHaveLength(31);
	});
});

describe("bucketEventsByDay", () => {
	it("groups RenewalItems by day-of-month from nextDueDate", () => {
		const items = [
			{
				id: 1,
				productName: "A",
				category: "Life",
				categoryLabel: "定期寿",
				premium: 100,
				nextDueDate: "2026-03-05",
				daysUntilDue: 0,
				insuredMemberName: "张伟",
				isSavings: false,
			},
			{
				id: 2,
				productName: "B",
				category: "Life",
				categoryLabel: "定期寿",
				premium: 200,
				nextDueDate: "2026-03-05",
				daysUntilDue: 0,
				insuredMemberName: "李雷",
				isSavings: false,
			},
			{
				id: 3,
				productName: "C",
				category: "Life",
				categoryLabel: "定期寿",
				premium: 300,
				nextDueDate: "2026-03-15",
				daysUntilDue: 0,
				insuredMemberName: "张伟",
				isSavings: false,
			},
		];
		const result = bucketEventsByDay(items);
		expect(result.size).toBe(2);
		expect(result.get(5)).toHaveLength(2);
		expect(result.get(15)).toHaveLength(1);
	});

	it("ignores items whose nextDueDate slice yields a non-numeric day", () => {
		const items = [
			{
				id: 1,
				productName: "A",
				category: "Life",
				categoryLabel: "定期寿",
				premium: 100,
				nextDueDate: "bad",
				daysUntilDue: 0,
				insuredMemberName: "x",
				isSavings: false,
			},
		];
		expect(bucketEventsByDay(items).size).toBe(0);
	});
});

describe("monthAccentClasses", () => {
	it("returns muted treatment for empty months", () => {
		const a = monthAccentClasses(0);
		expect(a.border).toContain("muted-foreground");
		expect(a.title).toContain("muted-foreground");
	});

	it("escalates from low primary opacity to full primary as count grows", () => {
		expect(monthAccentClasses(1).border).toContain("primary/30");
		expect(monthAccentClasses(2).border).toContain("primary/30");
		expect(monthAccentClasses(3).border).toContain("primary/60");
		expect(monthAccentClasses(5).border).toContain("primary/60");
		// Busy months (>5) recolor the title too, not just the border.
		const busy = monthAccentClasses(8);
		expect(busy.border).toContain("border-l-primary");
		expect(busy.border).not.toContain("/");
		expect(busy.title).toBe("text-primary");
	});
});
