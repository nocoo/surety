import { describe, expect, test } from "bun:test";
import {
  parseLocalDate,
  formatLocalDate,
  todayStr,
  getDaysFromToday,
  formatDaysFromToday,
  formatDateWithDays,
} from "@/lib/date-utils";

describe("date-utils", () => {
  describe("parseLocalDate", () => {
    test("parses YYYY-MM-DD to local midnight", () => {
      const d = parseLocalDate("2026-03-27");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(d.getDate()).toBe(27);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    });

    test("handles single-digit month and day", () => {
      const d = parseLocalDate("2026-1-5");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(0); // January
      expect(d.getDate()).toBe(5);
    });

    test("handles leap day", () => {
      const d = parseLocalDate("2024-02-29");
      expect(d.getMonth()).toBe(1);
      expect(d.getDate()).toBe(29);
    });
  });

  describe("formatLocalDate", () => {
    test("formats Date to YYYY-MM-DD", () => {
      const d = new Date(2026, 2, 27); // March 27, 2026 local
      expect(formatLocalDate(d)).toBe("2026-03-27");
    });

    test("zero-pads single-digit month and day", () => {
      const d = new Date(2026, 0, 5); // January 5
      expect(formatLocalDate(d)).toBe("2026-01-05");
    });

    test("roundtrips with parseLocalDate", () => {
      const original = "2026-12-31";
      const d = parseLocalDate(original);
      expect(formatLocalDate(d)).toBe(original);
    });

    test("roundtrips Feb 29 on a leap year", () => {
      const original = "2024-02-29";
      const d = parseLocalDate(original);
      expect(formatLocalDate(d)).toBe(original);
    });
  });

  describe("todayStr", () => {
    test("returns today's date in YYYY-MM-DD format", () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      expect(todayStr()).toBe(expected);
    });

    test("matches formatLocalDate(new Date())", () => {
      expect(todayStr()).toBe(formatLocalDate(new Date()));
    });
  });

  describe("getDaysFromToday", () => {
    test("returns null for null input", () => {
      expect(getDaysFromToday(null)).toBeNull();
    });

    test("returns 0 for today's date", () => {
      expect(getDaysFromToday(todayStr())).toBe(0);
    });

    test("returns positive for future dates", () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(getDaysFromToday(formatLocalDate(future))).toBe(10);
    });

    test("returns negative for past dates", () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      expect(getDaysFromToday(formatLocalDate(past))).toBe(-5);
    });

    test("parses date as local timezone (not UTC)", () => {
      // This should ALWAYS return 0 regardless of system timezone
      expect(getDaysFromToday(todayStr())).toBe(0);
    });
  });

  describe("formatDaysFromToday", () => {
    test("returns null for null input", () => {
      expect(formatDaysFromToday(null)).toBeNull();
    });

    test("returns '今天' for 0", () => {
      expect(formatDaysFromToday(0)).toBe("今天");
    });

    test("returns past format for negative", () => {
      expect(formatDaysFromToday(-3)).toBe("3天前");
    });

    test("returns future format for positive", () => {
      expect(formatDaysFromToday(7)).toBe("7天后");
    });
  });

  describe("formatDateWithDays", () => {
    test("returns null for null input", () => {
      expect(formatDateWithDays(null)).toBeNull();
    });

    test("includes date and annotation for today", () => {
      const today = todayStr();
      expect(formatDateWithDays(today)).toBe(`${today} (今天)`);
    });
  });
});
