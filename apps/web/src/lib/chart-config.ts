import {
	AXIS_CONFIG as BASALT_AXIS_CONFIG,
	BAR_RADIUS as BASALT_BAR_RADIUS,
	RESPONSIVE_CONTAINER_PROPS as BASALT_RESPONSIVE_CONTAINER_PROPS,
	getChartColor,
} from "@nocoo/basalt/charts/config";

/**
 * Chart configuration and utilities
 * Provides unified color palette, axis settings, and formatters for recharts
 */

const PALETTE_COLORS = Array.from({ length: 5 }, (_, index) => getChartColor(index));

const chartMuted = "hsl(var(--basalt-chart-muted))";

// ── Public API ──

/**
 * CHART_COLORS — semantic color map built from the CSS-variable palette.
 */
export const CHART_COLORS = {
	palette: PALETTE_COLORS,
	primary: PALETTE_COLORS[0] as string,
	success: PALETTE_COLORS[2] as string,
	warning: PALETTE_COLORS[3] as string,
	danger: PALETTE_COLORS[1] as string,
	muted: chartMuted,
} as const;

/**
 * Get color from palette by index (wraps around)
 */
export { getChartColor };

/**
 * Common axis configuration — uses CSS variable tokens
 */
export const AXIS_CONFIG = BASALT_AXIS_CONFIG;

/**
 * Common tooltip styles (for custom tooltip components)
 */
export const TOOLTIP_STYLES = {
	container:
		"rounded-basalt-md border border-basalt-border bg-basalt-popover px-basalt-space-md py-basalt-space-sm text-basalt-sm shadow-lg",
	title: "font-medium",
	value: "text-basalt-muted-foreground",
} as const;

/**
 * Common bar radius for rounded corners
 */
export const BAR_RADIUS = BASALT_BAR_RADIUS;

/**
 * Currency formatting is centralised in `@surety/api/lib/format`.
 * Re-exported here so chart code (which imports lots of helpers from
 * this module) can still grab it from a single place — but the rule
 * itself lives in one file only.
 */
export { formatCurrency } from "@surety/api/lib/format";

/**
 * Compact form for chart axis labels.
 *
 * Same rule as `formatCurrency` but strips the ¥ — axis ticks share
 * one visible "¥" on the axis title; repeating it on every tick adds
 * visual noise. Defensive against null / NaN for the same reason as
 * `formatCurrency`.
 */
export function formatCompact(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return "0";
	return value.toLocaleString("zh-CN");
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
	...BASALT_RESPONSIVE_CONTAINER_PROPS,
	height: "100%" as const,
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
