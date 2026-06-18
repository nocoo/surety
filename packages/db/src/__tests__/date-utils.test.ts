import { afterEach, describe, expect, test, vi } from "vitest";
import { todayInTimeZone, todayStr, formatLocalDate, parseLocalDate } from "../lib/date-utils";

describe("todayInTimeZone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns YYYY-MM-DD format", () => {
    const result = todayInTimeZone();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("yields tomorrow in Shanghai when UTC clock is late evening", () => {
    // 2026-01-15 23:30 UTC === 2026-01-16 07:30 Asia/Shanghai
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T23:30:00.000Z"));

    expect(todayInTimeZone("Asia/Shanghai")).toBe("2026-01-16");
    expect(todayInTimeZone("UTC")).toBe("2026-01-15");
  });

  test("yields previous day in Los Angeles relative to UTC midnight", () => {
    // 2026-06-10 03:00 UTC === 2026-06-09 20:00 America/Los_Angeles
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T03:00:00.000Z"));

    expect(todayInTimeZone("America/Los_Angeles")).toBe("2026-06-09");
    expect(todayInTimeZone("UTC")).toBe("2026-06-10");
  });

  test("default timezone is Asia/Shanghai", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T20:00:00.000Z")); // 2026-06-19 04:00 CST

    expect(todayInTimeZone()).toBe("2026-06-19");
  });
});

describe("parseLocalDate ↔ formatLocalDate round-trip", () => {
  test("preserves the calendar date", () => {
    const date = parseLocalDate("2026-02-29"); // clamps to Feb 28 in JS
    expect(formatLocalDate(date)).toBe("2026-03-01"); // 2026 is not a leap year
  });

  test("plain date stays stable", () => {
    expect(formatLocalDate(parseLocalDate("2026-06-18"))).toBe("2026-06-18");
  });

  test("todayStr matches formatLocalDate(new Date())", () => {
    expect(todayStr()).toBe(formatLocalDate(new Date()));
  });
});
