/**
 * Chart configuration and utilities
 * Provides unified color palette, axis settings, and formatters for recharts
 */

import { CHART_COLORS as PALETTE_COLORS, chartAxis, chartMuted } from "./palette";

// Re-export the CSS-variable-based palette as the primary chart color source
export { PALETTE_COLORS };

/**
 * Legacy CHART_COLORS — maps old hardcoded API to new palette.
 * Semantic aliases use CSS variables so they respond to theme changes.
 */
export const CHART_COLORS = {
  palette: PALETTE_COLORS,
  primary: PALETTE_COLORS[0]!,   // vermilion
  success: PALETTE_COLORS[4]!,   // green
  warning: PALETTE_COLORS[6]!,   // amber
  danger: PALETTE_COLORS[9]!,    // red
  muted: chartMuted,
} as const;

/**
 * Get color from palette by index (wraps around)
 */
export function getChartColor(index: number): string {
  return PALETTE_COLORS[index % PALETTE_COLORS.length]!;
}

/**
 * Common axis configuration — uses CSS variable tokens
 */
export const AXIS_CONFIG = {
  tick: { fontSize: 12, fill: chartAxis },
  axisLine: false as const,
  tickLine: false as const,
} as const;

/**
 * Common tooltip styles (for custom tooltip components)
 */
export const TOOLTIP_STYLES = {
  container: "rounded-md border bg-popover px-3 py-2 text-sm shadow-md",
  title: "font-medium",
  value: "text-muted-foreground",
} as const;

/**
 * Common bar radius for rounded corners
 */
export const BAR_RADIUS = {
  horizontal: [0, 4, 4, 0] as [number, number, number, number],
  vertical: [4, 4, 0, 0] as [number, number, number, number],
} as const;

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return `¥${value.toLocaleString()}`;
}

/**
 * Format number compactly (for axis labels)
 */
export function formatCompact(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}万`;
  }
  return value.toLocaleString();
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Pie chart label line configuration
 */
export const PIE_LABEL_LINE = {
  stroke: chartMuted,
  strokeWidth: 1,
} as const;

/**
 * Legend configuration
 */
export const LEGEND_CONFIG = {
  wrapperStyle: { fontSize: 12 },
} as const;
