"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CalendarDays } from "lucide-react";
import { ChartCard } from "@/components/charts";
import {
  AXIS_CONFIG,
  BAR_RADIUS,
  TOOLTIP_STYLES,
  formatCurrency,
  formatCompact,
  getChartColor,
} from "@/lib/chart-config";
import type { MonthlyRenewal } from "@/lib/renewal-calendar-vm";

interface MonthlyChartProps {
  data: MonthlyRenewal[];
  policyNames: string[];
}

interface ChartDataItem {
  name: string;
  month: string;
  [policyName: string]: string | number;
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
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  // Filter out zero values
  const nonZeroItems = payload.filter((p) => p.value > 0);
  if (nonZeroItems.length === 0) {
    return (
      <div className={TOOLTIP_STYLES.container}>
        <p className={TOOLTIP_STYLES.title}>{label}</p>
        <p className={TOOLTIP_STYLES.value}>无续保</p>
      </div>
    );
  }

  const total = nonZeroItems.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className={TOOLTIP_STYLES.container}>
      <p className={TOOLTIP_STYLES.title}>{label}</p>
      <div className="space-y-1 mt-1">
        {nonZeroItems.map((p, idx) => (
          <p key={idx} className="text-sm" style={{ color: p.fill }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
      <p className="text-sm font-medium mt-2 pt-1 border-t border-border">
        合计: {formatCurrency(total)}
      </p>
    </div>
  );
}

export function MonthlyChart({ data, policyNames }: MonthlyChartProps) {
  // Transform data for stacked bar chart by policy
  const chartData: ChartDataItem[] = data.map((month) => {
    const row: ChartDataItem = {
      name: month.monthLabel,
      month: month.month,
    };

    // Initialize all policies to 0
    for (const policyName of policyNames) {
      row[policyName] = 0;
    }

    // Sum premiums by policy name for this month
    for (const item of month.items) {
      const currentValue = row[item.productName];
      row[item.productName] =
        (typeof currentValue === "number" ? currentValue : 0) + item.premium;
    }

    return row;
  });

  // Get short month label (just month number)
  const getShortLabel = (monthLabel: string): string => {
    const match = monthLabel.match(/(\d+)月/);
    return match ? `${match[1]}月` : monthLabel;
  };

  return (
    <ChartCard title="月度续保分布" icon={CalendarDays} height="h-[400px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={chartData} margin={{ left: 10, right: 10, bottom: 10 }}>
          <XAxis
            dataKey="name"
            {...AXIS_CONFIG}
            interval={0}
            tickFormatter={getShortLabel}
            tick={{ fontSize: 11 }}
          />
          <YAxis tickFormatter={formatCompact} {...AXIS_CONFIG} />
          <Tooltip content={<ChartTooltip />} />
          {policyNames.map((policyName, index) => (
            <Bar
              key={policyName}
              dataKey={policyName}
              stackId="a"
              fill={getChartColor(index)}
              radius={
                index === policyNames.length - 1 ? BAR_RADIUS.vertical : [0, 0, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
