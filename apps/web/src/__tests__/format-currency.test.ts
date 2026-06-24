import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/chart-config";

describe("formatCurrency", () => {
  it("formats values with locale grouping and the ¥ sign", () => {
    expect(formatCurrency(0)).toBe("¥0");
    expect(formatCurrency(1234)).toBe("¥1,234");
    expect(formatCurrency(9999)).toBe("¥9,999");
  });

  it("keeps the same locale-grouped style for large values (no 万 compaction)", () => {
    expect(formatCurrency(10_000)).toBe("¥10,000");
    expect(formatCurrency(15_000)).toBe("¥15,000");
    expect(formatCurrency(1_500_000)).toBe("¥1,500,000");
    expect(formatCurrency(1_234_500)).toBe("¥1,234,500");
  });

  it("returns the zero placeholder for null/undefined/NaN/Infinity", () => {
    // Regression: a stale backend rollout served stats without
    // protectionPremium, the dashboard called formatCurrency(undefined)
    // and the whole page crashed with `Cannot read properties of
    // undefined (reading 'toLocaleString')`.
    expect(formatCurrency(undefined)).toBe("¥0");
    expect(formatCurrency(null)).toBe("¥0");
    expect(formatCurrency(NaN)).toBe("¥0");
    expect(formatCurrency(Infinity)).toBe("¥0");
    expect(formatCurrency(-Infinity)).toBe("¥0");
  });
});
