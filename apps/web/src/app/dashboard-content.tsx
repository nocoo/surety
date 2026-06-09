
import { useMemo } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CalendarX,
  Building2,
  FileText,
  Layers,
  PieChart,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import {
  DonutChart,
  HorizontalBarChart,
  InsurerChart,
  MemberCategoryChart,
  StackedValueChart,
  StackedTimelineChart,
} from "@/components/charts";
import { CHART_COLORS, formatCurrency } from "@/lib/chart-config";
import { createStatCards, type DashboardData, type DashboardStats, type StatCardData } from "@/lib/dashboard-vm";
import { greetingForHour, familySubtitle } from "@/lib/greeting";
import {
  computeCoverageHealth,
  buildActionItems,
  type CoverageHealth,
} from "@/lib/dashboard-health";
import { useMe } from "@/hooks/use-me";
import { getDisplayName } from "@/lib/user";
import { cn } from "@/lib/utils";
import { fetchAPI } from "@/api";

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

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CoverageHealthCard annualPremium={data.stats.totalPremium} />
        </div>
        <div className="lg:col-span-2">
          <ActionItemsCard
            renewal={data.charts.renewalTimeline}
            expiry={data.charts.expiryTimeline}
          />
        </div>
      </div>

      <details className="rounded-card bg-secondary/60">
        <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
          分布详情（{8} 张图表）
        </summary>
        <div className="space-y-6 px-5 pb-5 pt-2">
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
      </details>
    </div>
  );
}

/**
 * Health-of-coverage hero card. Pulls /api/settings/annualIncome
 * (lazy, SWR cache 60s) and joins it with the policy premium total
 * already in the dashboard payload, then computeCoverageHealth turns
 * the ratio into a verdict + recommendation.
 *
 * Renders a different visual tone per level — green when healthy,
 * warning when under/over, muted when unknown — and points the user
 * at /settings when no income is configured yet.
 */
function CoverageHealthCard({ annualPremium }: { annualPremium: number }) {
  // Settings API shape: { value: string | null }
  const { data: incomeSetting } = useSWR<{ value: string | null }>(
    "/api/settings/annualIncome",
    fetchAPI,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const annualIncome = Number(incomeSetting?.value ?? 0) || 0;
  const health = computeCoverageHealth(annualPremium, annualIncome);

  return (
    <article className={cn("rounded-card p-6 h-full flex flex-col gap-4", levelSurface(health.level))}>
      <header className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", levelIconBg(health.level))}>
          <ShieldCheck className={cn("h-5 w-5", levelIconColor(health.level))} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground/80">
            家庭保障健康度
          </p>
          <h2 className="font-display text-lg font-semibold">{health.title}</h2>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">{health.detail}</p>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold tabular-nums">
            {formatCurrency(annualPremium)}
          </span>
          <span className="text-xs text-muted-foreground">/ 年保费</span>
        </div>
        {health.level === "unknown" ? (
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            去设置年收入 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <RatioBar ratio={health.ratio ?? 0} level={health.level} />
        )}
      </div>
    </article>
  );
}

function RatioBar({ ratio, level }: { ratio: number; level: CoverageHealth["level"] }) {
  // Bar caps visually at 25% so the marker keeps room to breathe;
  // recommended band is 5..15%.
  const cap = 0.25;
  const pos = Math.min(ratio / cap, 1) * 100;
  return (
    <div className="w-full max-w-[240px]">
      <div className="relative h-2 rounded-full bg-muted/60">
        {/* Healthy band overlay 5..15% (= 20..60% of capped 25%) */}
        <div
          aria-hidden="true"
          className="absolute h-full rounded-full bg-success/30"
          style={{ left: `${(0.05 / cap) * 100}%`, width: `${((0.15 - 0.05) / cap) * 100}%` }}
        />
        {/* Current marker */}
        <div
          aria-hidden="true"
          className={cn("absolute -top-0.5 h-3 w-1 rounded-full", levelMarker(level))}
          style={{ left: `calc(${pos}% - 2px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0%</span>
        <span>5%</span>
        <span>15%</span>
        <span>25%+</span>
      </div>
    </div>
  );
}

function levelSurface(level: CoverageHealth["level"]): string {
  switch (level) {
    case "healthy": return "border border-success/20 bg-success/5";
    case "underinsured": return "border border-warning/30 bg-warning/5";
    case "overspent": return "border border-warning/30 bg-warning/5";
    default: return "bg-secondary";
  }
}
function levelIconBg(level: CoverageHealth["level"]): string {
  switch (level) {
    case "healthy": return "bg-success/15";
    case "underinsured":
    case "overspent": return "bg-warning/15";
    default: return "bg-primary/10";
  }
}
function levelIconColor(level: CoverageHealth["level"]): string {
  switch (level) {
    case "healthy": return "text-success-text";
    case "underinsured":
    case "overspent": return "text-warning-text";
    default: return "text-primary";
  }
}
function levelMarker(level: CoverageHealth["level"]): string {
  switch (level) {
    case "healthy": return "bg-success";
    case "underinsured":
    case "overspent": return "bg-warning";
    default: return "bg-primary";
  }
}

/**
 * Future-30-days action board. Reads the renewal and expiry timeline
 * already in the dashboard payload (so no extra fetch) and turns the
 * first bucket into one row per category — "重疾险有 3 份保单即将续费"
 * style. Empty state encourages the user to set up policies if there's
 * nothing happening soon.
 */
function ActionItemsCard({
  renewal,
  expiry,
}: {
  renewal: DashboardData["charts"]["renewalTimeline"];
  expiry: DashboardData["charts"]["expiryTimeline"];
}) {
  const items = buildActionItems(renewal, expiry);

  return (
    <article className="rounded-card bg-secondary p-6 h-full">
      <header className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <CalendarClock className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground/80">本月</p>
          <h2 className="font-display text-lg font-semibold">行动建议</h2>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          本月没有保单需要续费或到期，可以喘口气
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  item.tone === "warning" ? "bg-warning/20" : "bg-info/20",
                )}
              >
                <AlertCircle
                  className={cn(
                    "h-3 w-3",
                    item.tone === "warning" ? "text-warning-text" : "text-info-text",
                  )}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/renewal-calendar"
        className="mt-5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        查看续保日历 <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}
