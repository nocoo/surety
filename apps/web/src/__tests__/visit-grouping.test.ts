import { describe, it, expect } from "vitest";
import { groupVisitsByMonth, formatMonthLabel } from "@/lib/visit-grouping";

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

  it("drops visits with invalid date strings", () => {
    const visits = [
      { id: 1, visitDate: "2026-03-05" },
      { id: 2, visitDate: "garbage" },
      { id: 3, visitDate: "" },
    ];
    const result = groupVisitsByMonth(visits);
    expect(result).toHaveLength(1);
    expect(result[0]?.visits.map((v) => v.id)).toEqual([1]);
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

  it("returns the key unchanged when malformed", () => {
    expect(formatMonthLabel("garbage")).toBe("garbage");
    expect(formatMonthLabel("")).toBe("");
  });
});
