import { describe, it, expect } from "vitest";
import {
  computeCoverageHealth,
  buildActionItems,
} from "@/lib/dashboard-health";

describe("computeCoverageHealth", () => {
  it("returns unknown when annual income is missing or zero", () => {
    expect(computeCoverageHealth(10_000, 0).level).toBe("unknown");
    expect(computeCoverageHealth(10_000, -1).level).toBe("unknown");
    expect(computeCoverageHealth(10_000, NaN).level).toBe("unknown");
  });

  it("returns underinsured when premium < 5% of income", () => {
    // 10k / 1m = 1%
    const h = computeCoverageHealth(10_000, 1_000_000);
    expect(h.level).toBe("underinsured");
    expect(h.ratio).toBeCloseTo(0.01, 5);
    expect(h.title).toContain("1.0%");
  });

  it("returns healthy when premium is within 5..15%", () => {
    const low = computeCoverageHealth(50_000, 1_000_000); // 5%
    const mid = computeCoverageHealth(100_000, 1_000_000); // 10%
    const high = computeCoverageHealth(150_000, 1_000_000); // 15% — exclusive upper
    expect(low.level).toBe("healthy");
    expect(mid.level).toBe("healthy");
    expect(high.level).toBe("healthy");
  });

  it("returns overspent when premium > 15%", () => {
    const h = computeCoverageHealth(200_000, 1_000_000); // 20%
    expect(h.level).toBe("overspent");
    expect(h.title).toContain("20.0%");
  });

  it("communicates that the ratio is computed off protection-only premium", () => {
    // Every non-unknown verdict's detail line explicitly says "不含储蓄型"
    // so the user knows annuities / 增额终身寿 weren't included.
    const cases = [
      computeCoverageHealth(10_000, 1_000_000),
      computeCoverageHealth(100_000, 1_000_000),
      computeCoverageHealth(200_000, 1_000_000),
    ];
    for (const c of cases) {
      expect(c.detail).toContain("不含储蓄型");
    }
    // And the headline begins with "保障型" not just "保费"
    for (const c of cases) {
      expect(c.title).toContain("保障型保费");
    }
  });
});

describe("buildActionItems", () => {
  const empty = { data: [], categories: [] };

  it("returns empty when both timelines are empty", () => {
    expect(buildActionItems(empty, empty)).toEqual([]);
  });

  it("collects every category whose first bucket has count > 0", () => {
    const renewal = {
      categories: ["重疾险", "医疗险"],
      data: [
        { label: "0月内", 重疾险: 3, 医疗险: 1 },
        { label: "1-3月", 重疾险: 0, 医疗险: 0 },
      ],
    };
    const items = buildActionItems(renewal, empty);
    expect(items).toHaveLength(2);
    expect(items[0]?.tone).toBe("warning");
    expect(items[0]?.title).toContain("重疾险");
    expect(items[0]?.title).toContain("3");
    // Title aligns with the API's natural-month bucketing — see
    // dashboard-health.ts comment.
    expect(items[0]?.title).toContain("本月");
  });

  it("renders expiry items with info tone", () => {
    const expiry = {
      categories: ["车险"],
      data: [{ label: "0月内", 车险: 1 }],
    };
    const items = buildActionItems(empty, expiry);
    expect(items[0]?.tone).toBe("info");
    expect(items[0]?.title).toContain("车险");
    expect(items[0]?.title).toContain("本月");
  });

  it("respects the limit", () => {
    const renewal = {
      categories: ["a", "b", "c", "d", "e", "f", "g", "h"],
      data: [{ label: "0月内", a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1 }],
    };
    expect(buildActionItems(renewal, empty, 3)).toHaveLength(3);
  });

  it("ignores buckets with zero count", () => {
    const renewal = {
      categories: ["x", "y"],
      data: [{ label: "0月内", x: 0, y: 0 }],
    };
    expect(buildActionItems(renewal, empty)).toEqual([]);
  });
});
