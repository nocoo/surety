"use client";

import { useState, useEffect } from "react";
import { FileText, Users, TrendingUp, Shield } from "lucide-react";
import { AppShell } from "@/components/layout";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DashboardData {
  stats: {
    policyCount: number;
    memberCount: number;
    totalPremium: number;
    totalSumAssured: number;
  };
  charts: {
    premiumByCategory: {
      category: string;
      label: string;
      count: number;
      premium: number;
      sumAssured: number;
    }[];
    premiumByMember: {
      name: string;
      premium: number;
      count: number;
    }[];
    policyByInsurer: {
      name: string;
      count: number;
      premium: number;
    }[];
    policyByChannel: {
      name: string;
      count: number;
      premium: number;
    }[];
    coverageByCategory: {
      label: string;
      sumAssured: number;
    }[];
    policyByYear: {
      year: string;
      count: number;
      premium: number;
    }[];
  };
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210, 70%, 50%)",
  "hsl(280, 60%, 50%)",
  "hsl(30, 80%, 50%)",
];

function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return `¥${value.toLocaleString()}`;
}

function formatCompact(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}万`;
  }
  return value.toLocaleString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: Record<string, unknown>;
  }>;
}

function PremiumTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload as { label?: string; name?: string; premium: number; count?: number };
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{data.label ?? data.name}</p>
      <p className="text-muted-foreground">保费: {formatCurrency(data.premium)}</p>
      {data.count !== undefined && (
        <p className="text-muted-foreground">保单: {data.count} 份</p>
      )}
    </div>
  );
}

function InsurerTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload as { name: string; count: number; premium: number };
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{data.name}</p>
      <p className="text-muted-foreground">保单: {data.count} 份</p>
      <p className="text-muted-foreground">保费: {formatCurrency(data.premium)}</p>
    </div>
  );
}

function CoverageTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload as { label: string; sumAssured: number };
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{data.label}</p>
      <p className="text-muted-foreground">保额: {formatCurrency(data.sumAssured)}</p>
    </div>
  );
}

function YearTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null;
  const data = payload[0].payload as { year: string; count: number; premium: number };
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{data.year}年</p>
      <p className="text-muted-foreground">新增: {data.count} 份</p>
      <p className="text-muted-foreground">保费: {formatCurrency(data.premium)}</p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d: DashboardData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AppShell>
    );
  }

  const stats = [
    { label: "保单总数", value: String(data.stats.policyCount), icon: FileText },
    { label: "家庭成员", value: String(data.stats.memberCount), icon: Users },
    { label: "年保费", value: formatCurrency(data.stats.totalPremium), icon: TrendingUp },
    { label: "总保额", value: formatCurrency(data.stats.totalSumAssured), icon: Shield },
  ];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">仪表盘</h1>
          <p className="text-sm text-muted-foreground">家庭保障概览</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Premium by Category - Pie Chart */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold mb-4">保费构成</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.premiumByCategory}
                    dataKey="premium"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  >
                    {data.charts.premiumByCategory.map((entry, index) => (
                      <Cell key={`cell-${entry.category}`} fill={COLORS[index % COLORS.length] || "#888888"} />
                    ))}
                  </Pie>
                  <Tooltip content={<PremiumTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Premium by Member - Bar Chart */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold mb-4">成员保费分布</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.charts.premiumByMember}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCompact(v)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={60}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<PremiumTooltip />} />
                  <Bar dataKey="premium" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Coverage by Category - Horizontal Bar */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold mb-4">保障额度</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.charts.coverageByCategory}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCompact(v)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={60}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CoverageTooltip />} />
                  <Bar dataKey="sumAssured" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Policy by Channel - Pie Chart */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold mb-4">渠道分布</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.policyByChannel}
                    dataKey="premium"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  >
                    {data.charts.policyByChannel.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length] || "#888888"} />
                    ))}
                  </Pie>
                  <Tooltip content={<PremiumTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 3 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Policy by Insurer - Horizontal Bar */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold mb-4">保险公司</h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.charts.policyByInsurer}
                  layout="vertical"
                  margin={{ left: 60, right: 20 }}
                >
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<InsurerTooltip />} />
                  <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Policy by Year - Bar Chart */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold mb-4">投保年份</h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.policyByYear} margin={{ left: 10, right: 10 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}份`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => formatCompact(v)}
                  />
                  <Tooltip content={<YearTooltip />} />
                  <Legend
                    formatter={(value) => (value === "count" ? "保单数" : "保费")}
                  />
                  <Bar yAxisId="left" dataKey="count" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="premium" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
