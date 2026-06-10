import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/chart-config";

describe("formatCurrency", () => {
  it("formats values < 10000 with locale grouping", () => {
    expect(formatCurrency(0)).toBe("¥0");
    expect(formatCurrency(1234)).toBe("¥1,234");
    expect(formatCurrency(9999)).toBe("¥9,999");
  });

  it("formats values >= 10000 in 万 with one decimal when not whole", () => {
    expect(formatCurrency(10_000)).toBe("¥1万");
    expect(formatCurrency(15_000)).toBe("¥1.5万");
    expect(formatCurrency(1_500_000)).toBe("¥150万");
    expect(formatCurrency(1_234_500)).toBe("¥123.5万");
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
