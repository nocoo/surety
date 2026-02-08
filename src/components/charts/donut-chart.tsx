"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  CHART_COLORS,
  getChartColor,
  PIE_LABEL_LINE,
  TOOLTIP_STYLES,
  formatCurrency,
  formatPercent,
} from "@/lib/chart-config";

export interface DonutChartItem {
  name: string;
  value: number;
  count?: number;
}

interface DonutChartProps {
  data: DonutChartItem[];
  title: string;
  valueKey?: string;
  nameKey?: string;
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

export function DonutChart({ data, title }: DonutChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-base font-semibold mb-4">{title}</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
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
              label={({ name, percent }) =>
                `${name} ${formatPercent(percent ?? 0)}`
              }
              labelLine={PIE_LABEL_LINE}
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
    </div>
  );
}

export { CHART_COLORS };
