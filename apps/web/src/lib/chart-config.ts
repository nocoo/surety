/**
 * Chart configuration and utilities
 * Provides unified color palette, axis settings, and formatters for recharts
 */

import { hashString, AVATAR_PALETTE_SIZE } from "./utils";

// ── Color palette (CSS custom properties from globals.css) ──

/** Helper — wraps a CSS custom property name for inline style usage. */
const v = (token: string) => `hsl(var(--${token}))`;

const chart = {
  vermilion: v("chart-1"),  // Brand vermilion (= --primary)
  sky:       v("chart-2"),
  teal:      v("chart-3"),
  jade:      v("chart-4"),
  green:     v("chart-5"),
  lime:      v("chart-6"),
  amber:     v("chart-7"),
  orange:    v("chart-8"),
  blue:      v("chart-9"),
  red:       v("chart-10"),
  rose:      v("chart-11"),
  magenta:   v("chart-12"),
  orchid:    v("chart-13"),
  purple:    v("chart-14"),
  indigo:    v("chart-15"),
  cobalt:    v("chart-16"),
  steel:     v("chart-17"),
  cadet:     v("chart-18"),
  seafoam:   v("chart-19"),
  olive:     v("chart-20"),
  gold:      v("chart-21"),
  tangerine: v("chart-22"),
  crimson:   v("chart-23"),
  gray:      v("chart-24"),
} as const;

/** Ordered array — use for pie / donut / bar where you need N colors by index. */
const PALETTE_COLORS = Object.values(chart);

const chartAxis = v("chart-axis");
const chartMuted = v("chart-muted");

// ── Public API ──

/**
 * CHART_COLORS — semantic color map built from the CSS-variable palette.
 */
export const CHART_COLORS = {
  palette: PALETTE_COLORS,
  primary: PALETTE_COLORS[0] as string,   // vermilion
  success: PALETTE_COLORS[4] as string,   // green
  warning: PALETTE_COLORS[6] as string,   // amber
  danger: PALETTE_COLORS[9] as string,    // red
  muted: chartMuted,
} as const;

/**
 * Get color from palette by index (wraps around)
 */
export function getChartColor(index: number): string {
  return PALETTE_COLORS[index % PALETTE_COLORS.length] as string;
}

/**
 * Get a chart color for a named entity using the same hash + palette as
 * `getAvatarColor`. Use this when a chart series corresponds to a person
 * or asset who is also shown with an avatar elsewhere on screen — the
 * dot in the legend will then match the avatar background.
 *
 * For positional series (category index, time index), use `getChartColor`.
 */
export function getChartColorForName(name: string): string {
  const hash = hashString(name);
  const index = hash % AVATAR_PALETTE_SIZE;
  return PALETTE_COLORS[index] as string;
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
 * Shared ResponsiveContainer props to avoid repeated configuration.
 * - minWidth/minHeight=0: prevent flex/grid sizing issues
 * - initialDimension={1,1}: suppress recharts -1 initial size warning
 * - debounce=300: throttle resize callbacks to avoid jank during
 *   sidebar collapse/expand animation (also 300ms)
 */
export const RESPONSIVE_CONTAINER_PROPS = {
  width: "100%" as const,
  height: "100%" as const,
  minWidth: 0,
  minHeight: 0,
  initialDimension: { width: 1, height: 1 },
  debounce: 300,
} as const;

/**
 * Pie chart label line configuration
 */
export const PIE_LABEL_LINE = {
  stroke: chartMuted,
  strokeWidth: 1,
} as const;
