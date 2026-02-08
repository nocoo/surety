"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { CalendarDays } from "lucide-react";
import { ChartCard } from "@/components/charts";
import {
  CHART_COLORS,
  AXIS_CONFIG,
  BAR_RADIUS,
  TOOLTIP_STYLES,
  formatCurrency,
  formatCompact,
} from "@/lib/chart-config";
import type { MonthlyRenewal } from "@/lib/renewal-calendar-vm";

interface MonthlyChartProps {
  data: MonthlyRenewal[];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    fill: string;
    payload: MonthlyRenewal;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const monthData = payload[0]?.payload;
  if (!monthData) return null;

  return (
    <div className={TOOLTIP_STYLES.container}>
      <p className={TOOLTIP_STYLES.title}>{label}</p>
      <p className={TOOLTIP_STYLES.value}>
        储蓄险: {formatCurrency(monthData.savingsPremium)}
      </p>
      <p className={TOOLTIP_STYLES.value}>
        保障险: {formatCurrency(monthData.protectionPremium)}
      </p>
      <p className="text-sm font-medium mt-1">
        合计: {formatCurrency(monthData.totalPremium)} ({monthData.count} 次)
      </p>
    </div>
  );
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  // Transform data for chart
  const chartData = data.map((d) => ({
    ...d,
    name: d.monthLabel,
  }));

  return (
    <ChartCard title="月度续保分布" icon={CalendarDays} height="h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 10, right: 10, bottom: 20 }}>
          <XAxis
            dataKey="name"
            {...AXIS_CONFIG}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis tickFormatter={formatCompact} {...AXIS_CONFIG} />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            formatter={(value) =>
              value === "savingsPremium" ? "储蓄险" : "保障险"
            }
            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
          />
          <Bar
            dataKey="savingsPremium"
            stackId="a"
            fill={CHART_COLORS.warning}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="protectionPremium"
            stackId="a"
            fill={CHART_COLORS.success}
            radius={BAR_RADIUS.vertical}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
