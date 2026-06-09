/**
 * Dashboard types and view model
 * Separates data logic from UI for better testability
 */

import { formatCurrency } from "./chart-config";

// API response types
export interface DashboardStats {
  policyCount: number;
  memberCount: number;
  totalPremium: number;
  totalSumAssured: number;
}

export interface CategoryData {
  category: string;
  label: string;
  count: number;
  premium: number;
  sumAssured: number;
}

export interface MemberData {
  name: string;
  premium: number;
  count: number;
}

export interface InsurerData {
  name: string;
  count: number;
  premium: number;
}

export interface ChannelData {
  name: string;
  count: number;
  premium: number;
}

export interface CoverageData {
  label: string;
  sumAssured: number;
}

export interface YearData {
  year: string;
  count: number;
  premium: number;
}

// Stacked timeline data for renewal (monthly) and expiry (by period)
export interface StackedTimelineData {
  data: Array<{ label: string; [category: string]: string | number }>;
  categories: string[];
}

export interface MemberCategoryData {
  data: Array<{ name: string; [category: string]: string | number }>;
  categories: string[];
}

export interface DashboardCharts {
  premiumByCategory: CategoryData[];
  premiumByMember: MemberData[];
  policyByInsurer: InsurerData[];
  policyByChannel: ChannelData[];
  coverageByCategory: CoverageData[];
  memberByCategory: MemberCategoryData;
  memberPremiumByCategory: MemberCategoryData;
  memberCoverageByCategory: MemberCategoryData;
  renewalTimeline: StackedTimelineData;
  expiryTimeline: StackedTimelineData;
}

export interface DashboardData {
  stats: DashboardStats;
  charts: DashboardCharts;
}

// View model types for UI
export interface StatCardData {
  label: string;
  value: string;
  iconName: "FileText" | "Users" | "TrendingUp" | "Shield";
  /** Secondary line under the headline value (e.g. "重疾险占多数"). */
  sub?: string;
}

/**
 * Transform raw dashboard data into stat cards with the headline value
 * + an optional sub-line that adds context. The sub-line answers the
 * "so what" question for each metric:
 *
 *   保单总数 → which category dominates the portfolio
 *   家庭成员 → average policies per person
 *   年保费   → top category's share of total spend
 *   总保额   → top category's share of total coverage
 *
 * Sub-lines are derived from already-fetched chart data — no extra API
 * call, no risk of stale joins. When the supporting data is absent
 * (empty portfolio, first-time user), the sub-line is omitted rather
 * than showing a misleading "100%" derived from a single item.
 */
export function createStatCards(
  stats: DashboardStats,
  charts?: DashboardCharts,
): StatCardData[] {
  return [
    withSub(
      { label: "保单总数", value: String(stats.policyCount), iconName: "FileText" },
      topCategoryByCountSub(charts?.premiumByCategory),
    ),
    withSub(
      { label: "家庭成员", value: String(stats.memberCount), iconName: "Users" },
      averagePoliciesSub(stats),
    ),
    withSub(
      { label: "年保费", value: formatCurrency(stats.totalPremium), iconName: "TrendingUp" },
      topCategoryByPremiumSub(charts?.premiumByCategory, stats.totalPremium),
    ),
    withSub(
      { label: "总保额", value: formatCurrency(stats.totalSumAssured), iconName: "Shield" },
      topCategoryByCoverageSub(charts?.coverageByCategory, stats.totalSumAssured),
    ),
  ];
}

// exactOptionalPropertyTypes is on; with `sub: foo` the compiler would
// see `string | undefined` and reject it. Only attach the field when
// there's actually a string to assign.
function withSub(
  base: Omit<StatCardData, "sub">,
  sub: string | undefined,
): StatCardData {
  return sub === undefined ? base : { ...base, sub };
}

function topCategoryByCountSub(items: CategoryData[] | undefined): string | undefined {
  if (!items || items.length === 0) return undefined;
  const top = items.reduce((a, b) => (b.count > a.count ? b : a));
  if (top.count === 0) return undefined;
  return `${top.label} ${top.count} 份占多数`;
}

function averagePoliciesSub(stats: DashboardStats): string | undefined {
  if (stats.memberCount === 0 || stats.policyCount === 0) return undefined;
  const avg = stats.policyCount / stats.memberCount;
  return `人均 ${avg < 10 ? avg.toFixed(1) : Math.round(avg)} 份保单`;
}

function topCategoryByPremiumSub(
  items: CategoryData[] | undefined,
  totalPremium: number,
): string | undefined {
  if (!items || items.length === 0 || totalPremium <= 0) return undefined;
  const top = items.reduce((a, b) => (b.premium > a.premium ? b : a));
  if (top.premium === 0) return undefined;
  const pct = Math.round((top.premium / totalPremium) * 100);
  return `${top.label}占 ${pct}%`;
}

function topCategoryByCoverageSub(
  items: CoverageData[] | undefined,
  totalSumAssured: number,
): string | undefined {
  if (!items || items.length === 0 || totalSumAssured <= 0) return undefined;
  const top = items.reduce((a, b) => (b.sumAssured > a.sumAssured ? b : a));
  if (top.sumAssured === 0) return undefined;
  const pct = Math.round((top.sumAssured / totalSumAssured) * 100);
  return `${top.label}占 ${pct}%`;
}

/**
 * Fetch dashboard data from API
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard");
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.status}`);
  }
  return response.json();
}
