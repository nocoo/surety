/**
 * Chart configuration and utilities
 * Provides unified color palette, axis settings, and formatters for recharts
 */

// Unified color palette - using direct color values since recharts doesn't support CSS variables
export const CHART_COLORS = {
  // Primary palette for categorical data
  palette: [
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#8b5cf6", // violet-500
    "#ef4444", // red-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
    "#84cc16", // lime-500
  ],
  // Semantic colors
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
} as const;

/**
 * Get color from palette by index (wraps around)
 */
export function getChartColor(index: number): string {
  return CHART_COLORS.palette[index % CHART_COLORS.palette.length] || CHART_COLORS.primary;
}

/**
 * Common axis configuration
 */
export const AXIS_CONFIG = {
  tick: { fontSize: 12, fill: "#64748b" },
  axisLine: { stroke: "#e2e8f0" },
  tickLine: { stroke: "#e2e8f0" },
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
  stroke: "#94a3b8",
  strokeWidth: 1,
} as const;

/**
 * Legend configuration
 */
export const LEGEND_CONFIG = {
  wrapperStyle: { fontSize: 12 },
} as const;
