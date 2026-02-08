"use client";

import { useState, useEffect } from "react";
import { FileText, Users, TrendingUp, Shield, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout";
import {
  DonutChart,
  HorizontalBarChart,
  YearTrendChart,
  InsurerChart,
} from "@/components/charts";
import { CHART_COLORS } from "@/lib/chart-config";
import {
  createStatCards,
  fetchDashboardData,
  type DashboardData,
  type StatCardData,
} from "@/lib/dashboard-vm";

// Icon map for stat cards
const ICON_MAP: Record<StatCardData["iconName"], LucideIcon> = {
  FileText,
  Users,
  TrendingUp,
  Shield,
};

function StatCard({ label, value, iconName }: StatCardData) {
  const Icon = ICON_MAP[iconName];
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold">{value}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData()
      .then((d) => {
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

  const statCards = createStatCards(data.stats);

  // Transform data for charts
  const premiumByCategoryData = data.charts.premiumByCategory.map((item) => ({
    name: item.label,
    value: item.premium,
    count: item.count,
  }));

  const premiumByMemberData = data.charts.premiumByMember.map((item) => ({
    name: item.name,
    value: item.premium,
    count: item.count,
  }));

  const coverageData = data.charts.coverageByCategory.map((item) => ({
    name: item.label,
    value: item.sumAssured,
  }));

  const channelData = data.charts.policyByChannel.map((item) => ({
    name: item.name,
    value: item.premium,
    count: item.count,
  }));

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">仪表盘</h1>
          <p className="text-sm text-muted-foreground">家庭保障概览</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <DonutChart data={premiumByCategoryData} title="保费构成" />
          <HorizontalBarChart
            data={premiumByMemberData}
            title="成员保费分布"
            color={CHART_COLORS.primary}
          />
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <HorizontalBarChart
            data={coverageData}
            title="保障额度"
            color={CHART_COLORS.palette[1]}
          />
          <DonutChart data={channelData} title="渠道分布" />
        </div>

        {/* Charts Row 3 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <InsurerChart
            data={data.charts.policyByInsurer}
            title="保险公司"
          />
          <YearTrendChart
            data={data.charts.policyByYear}
            title="投保年份"
          />
        </div>
      </div>
    </AppShell>
  );
}
