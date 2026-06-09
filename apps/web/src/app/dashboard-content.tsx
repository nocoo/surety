
import { useMemo } from "react";
import {
  FileText,
  Users,
  TrendingUp,
  Shield,
  PieChart,
  Building2,
  Layers,
  CalendarClock,
  CalendarX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  DonutChart,
  HorizontalBarChart,
  InsurerChart,
  MemberCategoryChart,
  StackedValueChart,
  StackedTimelineChart,
} from "@/components/charts";
import { CHART_COLORS } from "@/lib/chart-config";
import { createStatCards, type DashboardData, type DashboardStats, type StatCardData } from "@/lib/dashboard-vm";
import { greetingForHour, familySubtitle } from "@/lib/greeting";
import { useMe } from "@/hooks/use-me";
import { getDisplayName } from "@/lib/user";

const ICON_MAP: Record<StatCardData["iconName"], LucideIcon> = {
  FileText,
  Users,
  TrendingUp,
  Shield,
};

function StatCard({ label, value, iconName, index }: StatCardData & { index: number }) {
  const Icon = ICON_MAP[iconName];
  return (
    <div
      className="rounded-card bg-secondary p-6 animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="rounded-md bg-background p-2">
          <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold font-display tabular-nums">{value}</span>
      </div>
    </div>
  );
}

/**
 * Family-tone dashboard header — greets the signed-in user by name, and
 * tells them in plain language how many people / policies they're
 * tracking instead of the previous "家庭保障概览" boilerplate.
 *
 * `new Date()` is called inline because the greeting is purely
 * cosmetic — re-renders see the same hour bucket for at least an hour,
 * and there's no SSR / hydration concern (this is a Vite SPA).
 */
function DashboardHeader({ stats }: { stats: DashboardStats }) {
  const { data: user } = useMe();
  const { name } = getDisplayName(user);
  const greeting = greetingForHour(new Date().getHours());
  const subtitle = familySubtitle(stats.memberCount, stats.policyCount);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {greeting}，{name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function DashboardContent({ data }: { data: DashboardData }) {
  const statCards = createStatCards(data.stats);

  const premiumByCategoryData = useMemo(
    () =>
      data.charts.premiumByCategory.map((item) => ({
        name: item.label,
        value: item.premium,
        count: item.count,
      })),
    [data.charts.premiumByCategory]
  );

  const coverageData = useMemo(
    () =>
      data.charts.coverageByCategory.map((item) => ({
        name: item.label,
        value: item.sumAssured,
      })),
    [data.charts.coverageByCategory]
  );

  const categoryCountData = useMemo(
    () =>
      data.charts.premiumByCategory.map((item) => ({
        name: item.label,
        value: item.count,
      })),
    [data.charts.premiumByCategory]
  );

  const channelData = useMemo(
    () =>
      data.charts.policyByChannel.map((item) => ({
        name: item.name,
        value: item.premium,
        count: item.count,
      })),
    [data.charts.policyByChannel]
  );

  return (
    <div className="space-y-8">
      <DashboardHeader stats={data.stats} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <StatCard key={stat.label} {...stat} index={i} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DonutChart data={premiumByCategoryData} title="保费构成" icon={PieChart} />
        <StackedValueChart
          data={data.charts.memberPremiumByCategory.data}
          categories={data.charts.memberPremiumByCategory.categories}
          title="成员保费分布"
          icon={Wallet}
          valueLabel="保费"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DonutChart data={coverageData} title="保障额度构成" icon={Shield} />
        <StackedValueChart
          data={data.charts.memberCoverageByCategory.data}
          categories={data.charts.memberCoverageByCategory.categories}
          title="成员保障额度"
          icon={Shield}
          valueLabel="保额"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HorizontalBarChart
          data={categoryCountData}
          title="险种构成"
          icon={Layers}
          color={CHART_COLORS.palette[2] as string}
          formatValue={(v) => `${v}份`}
        />
        <MemberCategoryChart
          data={data.charts.memberByCategory.data}
          categories={data.charts.memberByCategory.categories}
          title="成员险种分布"
          icon={Layers}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StackedTimelineChart
          data={data.charts.renewalTimeline.data}
          categories={data.charts.renewalTimeline.categories}
          title="续费时间分布"
          icon={CalendarClock}
          emptyMessage="暂无续费数据"
        />
        <StackedTimelineChart
          data={data.charts.expiryTimeline.data}
          categories={data.charts.expiryTimeline.categories}
          title="到期时间分布"
          icon={CalendarX}
          emptyMessage="暂无到期数据"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InsurerChart
          data={data.charts.policyByInsurer}
          title="保险公司分布"
          icon={Building2}
        />
        <DonutChart data={channelData} title="缴费渠道分布" icon={Wallet} />
      </div>
    </div>
  );
}
