import { describe, expect, test } from "bun:test";
import { getDaysFromToday, formatDaysFromToday, formatDateWithDays } from "@/lib/date-utils";

describe("date-utils", () => {
  describe("getDaysFromToday", () => {
    test("returns null for null input", () => {
      expect(getDaysFromToday(null)).toBeNull();
    });

    test("returns 0 for today's date", () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      expect(getDaysFromToday(dateStr)).toBe(0);
    });

    test("returns positive for future dates", () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const yyyy = future.getFullYear();
      const mm = String(future.getMonth() + 1).padStart(2, "0");
      const dd = String(future.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      expect(getDaysFromToday(dateStr)).toBe(10);
    });

    test("returns negative for past dates", () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      const yyyy = past.getFullYear();
      const mm = String(past.getMonth() + 1).padStart(2, "0");
      const dd = String(past.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      expect(getDaysFromToday(dateStr)).toBe(-5);
    });

    test("parses date as local timezone (not UTC)", () => {
      // Construct "today" string manually — this should ALWAYS return 0
      // regardless of timezone, because we use local-date parsing.
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      expect(getDaysFromToday(`${y}-${m}-${d}`)).toBe(0);
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
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      expect(formatDateWithDays(dateStr)).toBe(`${dateStr} (今天)`);
    });
  });
});
