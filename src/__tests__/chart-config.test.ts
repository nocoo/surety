import { describe, expect, test } from "bun:test";
import {
  CHART_COLORS,
  getChartColor,
  formatCurrency,
  formatCompact,
  formatPercent,
  AXIS_CONFIG,
  BAR_RADIUS,
  PIE_LABEL_LINE,
  TOOLTIP_STYLES,
  LEGEND_CONFIG,
} from "@/lib/chart-config";

describe("chart-config", () => {
  describe("CHART_COLORS", () => {
    test("palette has 24 colors", () => {
      expect(CHART_COLORS.palette).toHaveLength(24);
    });

    test("all palette colors are CSS variable references", () => {
      const cssVarPattern = /^hsl\(var\(--chart-\d+\)\)$/;
      for (const color of CHART_COLORS.palette) {
        expect(color).toMatch(cssVarPattern);
      }
    });

    test("semantic colors are defined", () => {
      expect(CHART_COLORS.primary).toBeDefined();
      expect(CHART_COLORS.success).toBeDefined();
      expect(CHART_COLORS.warning).toBeDefined();
      expect(CHART_COLORS.danger).toBeDefined();
      expect(CHART_COLORS.muted).toBeDefined();
    });
  });

  describe("getChartColor", () => {
    test("returns color at index", () => {
      expect(getChartColor(0)).toBe(CHART_COLORS.palette[0]!);
      expect(getChartColor(1)).toBe(CHART_COLORS.palette[1]!);
    });

    test("wraps around for index >= palette length", () => {
      expect(getChartColor(24)).toBe(CHART_COLORS.palette[0]!);
      expect(getChartColor(25)).toBe(CHART_COLORS.palette[1]!);
      expect(getChartColor(48)).toBe(CHART_COLORS.palette[0]!);
    });
  });

  describe("formatCurrency", () => {
    test("formats small numbers with yen symbol", () => {
      expect(formatCurrency(100)).toBe("¥100");
      expect(formatCurrency(1000)).toBe("¥1,000");
      expect(formatCurrency(9999)).toBe("¥9,999");
    });

    test("formats numbers >= 10000 in 万 units", () => {
      expect(formatCurrency(10000)).toBe("¥1万");
      expect(formatCurrency(15000)).toBe("¥1.5万");
      expect(formatCurrency(100000)).toBe("¥10万");
      expect(formatCurrency(1000000)).toBe("¥100万");
    });

    test("removes decimal when divisible by 10000", () => {
      expect(formatCurrency(20000)).toBe("¥2万");
      expect(formatCurrency(50000)).toBe("¥5万");
    });

    test("handles zero", () => {
      expect(formatCurrency(0)).toBe("¥0");
    });
  });

  describe("formatCompact", () => {
    test("formats small numbers normally", () => {
      expect(formatCompact(100)).toBe("100");
      expect(formatCompact(1000)).toBe("1,000");
      expect(formatCompact(9999)).toBe("9,999");
    });

    test("formats numbers >= 10000 in 万 units", () => {
      expect(formatCompact(10000)).toBe("1万");
      expect(formatCompact(50000)).toBe("5万");
      expect(formatCompact(100000)).toBe("10万");
    });

    test("formats numbers >= 100000000 in 亿 units", () => {
      expect(formatCompact(100000000)).toBe("1.0亿");
      expect(formatCompact(500000000)).toBe("5.0亿");
    });
  });

  describe("formatPercent", () => {
    test("formats decimal as percentage", () => {
      expect(formatPercent(0.5)).toBe("50%");
      expect(formatPercent(0.25)).toBe("25%");
      expect(formatPercent(1)).toBe("100%");
      expect(formatPercent(0)).toBe("0%");
    });

    test("rounds to nearest integer", () => {
      expect(formatPercent(0.333)).toBe("33%");
      expect(formatPercent(0.666)).toBe("67%");
    });
  });

  describe("configuration constants", () => {
    test("AXIS_CONFIG has required properties", () => {
      expect(AXIS_CONFIG.tick).toBeDefined();
      expect(AXIS_CONFIG.tick.fontSize).toBe(12);
      expect(AXIS_CONFIG.axisLine).toBe(false);
      expect(AXIS_CONFIG.tickLine).toBe(false);
    });

    test("BAR_RADIUS has horizontal and vertical configs", () => {
      expect(BAR_RADIUS.horizontal).toHaveLength(4);
      expect(BAR_RADIUS.vertical).toHaveLength(4);
    });

    test("PIE_LABEL_LINE has stroke properties", () => {
      expect(PIE_LABEL_LINE.stroke).toBeDefined();
      expect(PIE_LABEL_LINE.strokeWidth).toBe(1);
    });

    test("TOOLTIP_STYLES has class names", () => {
      expect(TOOLTIP_STYLES.container).toContain("rounded");
      expect(TOOLTIP_STYLES.title).toContain("font-medium");
      expect(TOOLTIP_STYLES.value).toContain("muted");
    });

    test("LEGEND_CONFIG has wrapper style", () => {
      expect(LEGEND_CONFIG.wrapperStyle).toBeDefined();
      expect(LEGEND_CONFIG.wrapperStyle.fontSize).toBe(12);
    });
  });
});
