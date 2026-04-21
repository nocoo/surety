"use client";

import { type LucideIcon } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  getChartColor,
  PIE_LABEL_LINE,
  TOOLTIP_STYLES,
  formatCurrency,
  formatPercent,
  RESPONSIVE_CONTAINER_PROPS,
} from "@/lib/chart-config";
import { ChartCard } from "./chart-card";

export interface DonutChartItem {
  name: string;
  value: number;
  count?: number;
}

interface DonutChartProps {
  data: DonutChartItem[];
  title: string;
  icon: LucideIcon;
  emptyMessage?: string;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DonutChartItem }>;
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload;
  return (
    <div className={TOOLTIP_STYLES.container}>
      <p className={TOOLTIP_STYLES.title}>{data.name}</p>
      <p className={TOOLTIP_STYLES.value}>金额: {formatCurrency(data.value)}</p>
      {data.count !== undefined && (
        <p className={TOOLTIP_STYLES.value}>数量: {data.count} 份</p>
      )}
    </div>
  );
}

export function DonutChart({ data, title, icon, emptyMessage = "暂无数据" }: DonutChartProps) {
  const hasData = data.length > 0 && data.some((item) => item.value > 0);

  if (!hasData) {
    return (
      <ChartCard title={title} icon={icon}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {emptyMessage}
        </div>
      </ChartCard>
    );
  }

  const shouldUseCompactLabels = data.length > 5;
  const labelThreshold = 0.08;
  const shouldShowLegend = shouldUseCompactLabels;
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard title={title} icon={icon}>
      <div className="flex h-full flex-col gap-3">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer {...RESPONSIVE_CONTAINER_PROPS}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                label={({ name, percent }) => {
                  if (shouldUseCompactLabels && (percent ?? 0) < labelThreshold) {
                    return "";
                  }
                  return `${name} ${formatPercent(percent ?? 0)}`;
                }}
                labelLine={shouldUseCompactLabels ? false : PIE_LABEL_LINE}
                style={{ fontSize: 12 }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={getChartColor(index)}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {shouldShowLegend && (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getChartColor(index) }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-muted-foreground">{entry.name}</span>
                </div>
                <span className="shrink-0 font-medium">{formatPercent(total === 0 ? 0 : entry.value / total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
