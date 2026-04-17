import { describe, expect, test } from "bun:test";
import { formatCurrency, formatCurrencyFull } from "@/lib/format";

describe("formatCurrency", () => {
  test("formats values >= 10000 as 万 without decimals when exact", () => {
    expect(formatCurrency(10000)).toBe("1万");
    expect(formatCurrency(50000)).toBe("5万");
    expect(formatCurrency(1000000)).toBe("100万");
  });

  test("formats values >= 10000 with 1 decimal when not exact", () => {
    expect(formatCurrency(12345)).toBe("1.2万");
    expect(formatCurrency(15000)).toBe("1.5万");
    expect(formatCurrency(99999)).toBe("10.0万");
  });

  test("formats values < 10000 as CNY currency with no decimals", () => {
    const result = formatCurrency(500);
    expect(result).toContain("500");
    expect(result).not.toContain(".");
  });

  test("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  test("formats values just below threshold", () => {
    const result = formatCurrency(9999);
    expect(result).toContain("9,999");
  });
});

describe("formatCurrencyFull", () => {
  test("formats with exactly 2 decimals", () => {
    const result = formatCurrencyFull(1234.5);
    expect(result).toContain("1,234.50");
  });

  test("formats zero with 2 decimals", () => {
    const result = formatCurrencyFull(0);
    expect(result).toContain("0.00");
  });

  test("rounds to 2 decimals", () => {
    const result = formatCurrencyFull(1.999);
    expect(result).toContain("2.00");
  });

  test("formats large values with 2 decimals", () => {
    const result = formatCurrencyFull(1234567.89);
    expect(result).toContain("1,234,567.89");
  });

  test("formats negative values", () => {
    const result = formatCurrencyFull(-100.5);
    expect(result).toContain("100.50");
  });
});
