/**
 * Dashboard types and view model
 * Separates data logic from UI for better testability
 */

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

export interface TimelineData {
  month: string;
  count: number;
  premium: number;
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
  renewalTimeline: TimelineData[];
  expiryTimeline: TimelineData[];
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
}

/**
 * Transform raw dashboard data into stat cards
 */
export function createStatCards(stats: DashboardStats): StatCardData[] {
  return [
    {
      label: "保单总数",
      value: String(stats.policyCount),
      iconName: "FileText",
    },
    {
      label: "家庭成员",
      value: String(stats.memberCount),
      iconName: "Users",
    },
    {
      label: "年保费",
      value: formatStatCurrency(stats.totalPremium),
      iconName: "TrendingUp",
    },
    {
      label: "总保额",
      value: formatStatCurrency(stats.totalSumAssured),
      iconName: "Shield",
    },
  ];
}

/**
 * Format currency for stat display
 */
export function formatStatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return `¥${value.toLocaleString()}`;
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
