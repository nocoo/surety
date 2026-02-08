"use client";

import { type LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  CHART_COLORS,
  AXIS_CONFIG,
  BAR_RADIUS,
  TOOLTIP_STYLES,
  formatCurrency,
  formatCompact,
  getChartColor,
} from "@/lib/chart-config";
import { ChartCard } from "./chart-card";

export interface HorizontalBarItem {
  name: string;
  value: number;
  count?: number;
  premium?: number;
}

interface HorizontalBarChartProps {
  data: HorizontalBarItem[];
  title: string;
  icon: LucideIcon;
  valueKey?: string;
  color?: string;
  formatValue?: (value: number) => string;
}

function ChartTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ payload: HorizontalBarItem; dataKey: string; value: number }>;
  formatValue?: ((value: number) => string) | undefined;
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload;
  const value = payload[0].value;
  const formatter = formatValue ?? formatCurrency;
  
  return (
    <div className={TOOLTIP_STYLES.container}>
      <p className={TOOLTIP_STYLES.title}>{data.name}</p>
      <p className={TOOLTIP_STYLES.value}>数值: {formatter(value)}</p>
      {data.count !== undefined && (
        <p className={TOOLTIP_STYLES.value}>保单: {data.count} 份</p>
      )}
      {data.premium !== undefined && (
        <p className={TOOLTIP_STYLES.value}>保费: {formatCurrency(data.premium)}</p>
      )}
    </div>
  );
}

export function HorizontalBarChart({
  data,
  title,
  icon,
  valueKey = "value",
  color = CHART_COLORS.primary,
  formatValue,
}: HorizontalBarChartProps) {
  const formatter = formatValue ?? formatCompact;
  
  return (
    <ChartCard title={title} icon={icon}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 20, right: 20 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatter}
            {...AXIS_CONFIG}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={60}
            {...AXIS_CONFIG}
          />
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
          <Bar
            dataKey={valueKey}
            fill={color}
            radius={BAR_RADIUS.horizontal}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Vertical bar chart with dual axis for year trend
export interface YearTrendItem {
  year: string;
  count: number;
  premium: number;
}

interface YearTrendChartProps {
  data: YearTrendItem[];
  title: string;
  icon: LucideIcon;
}

function YearTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: YearTrendItem }>;
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload;
  return (
    <div className={TOOLTIP_STYLES.container}>
      <p className={TOOLTIP_STYLES.title}>{data.year}年</p>
      <p className={TOOLTIP_STYLES.value}>新增: {data.count} 份</p>
      <p className={TOOLTIP_STYLES.value}>保费: {formatCurrency(data.premium)}</p>
    </div>
  );
}

export function YearTrendChart({ data, title, icon }: YearTrendChartProps) {
  return (
    <ChartCard title={title} icon={icon} height="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 10, right: 10 }}>
          <XAxis dataKey="year" {...AXIS_CONFIG} />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(v) => `${v}份`}
            {...AXIS_CONFIG}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatCompact}
            {...AXIS_CONFIG}
          />
          <Tooltip content={<YearTooltip />} />
          <Legend
            formatter={(value) => (value === "count" ? "保单数" : "保费")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar
            yAxisId="left"
            dataKey="count"
            fill={CHART_COLORS.palette[3]}
            radius={BAR_RADIUS.vertical}
          />
          <Bar
            yAxisId="right"
            dataKey="premium"
            fill={CHART_COLORS.palette[4]}
            radius={BAR_RADIUS.vertical}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Insurer bar chart with taller height
interface InsurerChartProps {
  data: Array<{ name: string; count: number; premium: number }>;
  title: string;
  icon: LucideIcon;
}

function InsurerTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; count: number; premium: number } }>;
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload;
  return (
    <div className={TOOLTIP_STYLES.container}>
      <p className={TOOLTIP_STYLES.title}>{data.name}</p>
      <p className={TOOLTIP_STYLES.value}>保单: {data.count} 份</p>
      <p className={TOOLTIP_STYLES.value}>保费: {formatCurrency(data.premium)}</p>
    </div>
  );
}

export function InsurerChart({ data, title, icon }: InsurerChartProps) {
  return (
    <ChartCard title={title} icon={icon} height="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 60, right: 20 }}
        >
          <XAxis type="number" {...AXIS_CONFIG} />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <Tooltip content={<InsurerTooltip />} />
          <Bar
            dataKey="count"
            fill={CHART_COLORS.palette[2]}
            radius={BAR_RADIUS.horizontal}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Stacked bar chart for member-category breakdown
export interface MemberCategoryItem {
  name: string;
  [category: string]: string | number;
}

interface MemberCategoryChartProps {
  data: MemberCategoryItem[];
  categories: string[];
  title: string;
  icon: LucideIcon;
}

function MemberCategoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className={TOOLTIP_STYLES.container}>
      <p className={TOOLTIP_STYLES.title}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={TOOLTIP_STYLES.value} style={{ color: p.fill }}>
          {p.name}: {p.value} 份
        </p>
      ))}
      <p className="text-sm font-medium mt-1">合计: {total} 份</p>
    </div>
  );
}

export function MemberCategoryChart({ data, categories, title, icon }: MemberCategoryChartProps) {
  return (
    <ChartCard title={title} icon={icon}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 20, right: 20 }}
        >
          <XAxis type="number" {...AXIS_CONFIG} />
          <YAxis
            type="category"
            dataKey="name"
            width={60}
            {...AXIS_CONFIG}
          />
          <Tooltip content={<MemberCategoryTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {categories.map((category, index) => (
            <Bar
              key={category}
              dataKey={category}
              stackId="a"
              fill={getChartColor(index)}
              {...(index === categories.length - 1 ? { radius: BAR_RADIUS.horizontal } : {})}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export { CHART_COLORS };
