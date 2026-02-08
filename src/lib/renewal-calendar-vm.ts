/**
 * Renewal Calendar ViewModel
 * Pure functions for calculating renewal data - testable without API calls
 */

// Category labels
export const CATEGORY_LABELS: Record<string, string> = {
  Life: "寿险",
  CriticalIllness: "重疾险",
  Medical: "医疗险",
  Accident: "意外险",
  Annuity: "年金险",
  Property: "财产险",
};

// Savings insurance categories (separate calculation)
export const SAVINGS_CATEGORIES = ["Annuity", "Life"];

// ============================================================================
// Types
// ============================================================================

export interface PolicyForRenewal {
  id: number;
  productName: string;
  category: string;
  premium: number;
  paymentFrequency: "Single" | "Monthly" | "Yearly";
  nextDueDate: string | null;
  insuredMemberName?: string;
}

export interface RenewalItem {
  id: number;
  productName: string;
  category: string;
  categoryLabel: string;
  premium: number;
  nextDueDate: string;
  daysUntilDue: number;
  insuredMemberName: string;
  isSavings: boolean;
}

export interface MonthlyRenewal {
  month: string; // YYYY-MM
  monthLabel: string; // e.g., "2026年3月"
  items: RenewalItem[];
  totalPremium: number;
  savingsPremium: number;
  protectionPremium: number;
  count: number;
}

export interface RenewalSummary {
  totalPremium: number;
  savingsPremium: number;
  protectionPremium: number;
  totalCount: number;
  renewalCount: number; // total renewal events considering frequency
}

export interface RenewalCalendarData {
  summary: RenewalSummary;
  monthlyData: MonthlyRenewal[];
  upcomingRenewals: RenewalItem[];
}

// ============================================================================
// Pure calculation functions
// ============================================================================

/**
 * Calculate days between two dates
 */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * Get month label in Chinese format
 */
export function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year ?? ""}年${parseInt(month ?? "0", 10)}月`;
}

/**
 * Check if a category is savings insurance
 */
export function isSavingsCategory(category: string): boolean {
  return SAVINGS_CATEGORIES.includes(category);
}

/**
 * Calculate renewal dates within a period for a policy
 * Returns all renewal dates considering payment frequency
 */
export function calculateRenewalDates(
  nextDueDate: string,
  paymentFrequency: "Single" | "Monthly" | "Yearly",
  startDate: Date,
  endDate: Date
): Date[] {
  if (paymentFrequency === "Single") {
    return [];
  }

  const renewalDates: Date[] = [];
  let currentDate = new Date(nextDueDate);

  // Interval in months
  const intervalMonths = paymentFrequency === "Monthly" ? 1 : 12;

  // Find all renewal dates within the period
  while (currentDate <= endDate) {
    if (currentDate >= startDate) {
      renewalDates.push(new Date(currentDate));
    }
    // Move to next renewal date
    currentDate = addMonths(currentDate, intervalMonths);
  }

  return renewalDates;
}

/**
 * Add months to a date (handles month overflow correctly)
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  // Handle month overflow (e.g., Jan 31 + 1 month should be Feb 28)
  if (result.getDate() !== day) {
    result.setDate(0); // Go to last day of previous month
  }
  return result;
}

/**
 * Format date to YYYY-MM
 */
export function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Transform policy data to renewal items within a time range
 */
export function calculateRenewalItems(
  policies: PolicyForRenewal[],
  referenceDate: Date,
  monthsAhead: number = 12
): RenewalItem[] {
  const endDate = addMonths(referenceDate, monthsAhead);
  const items: RenewalItem[] = [];

  for (const policy of policies) {
    if (!policy.nextDueDate || policy.paymentFrequency === "Single") {
      continue;
    }

    const renewalDates = calculateRenewalDates(
      policy.nextDueDate,
      policy.paymentFrequency,
      referenceDate,
      endDate
    );

    for (const date of renewalDates) {
      items.push({
        id: policy.id,
        productName: policy.productName,
        category: policy.category,
        categoryLabel: CATEGORY_LABELS[policy.category] ?? policy.category,
        premium: policy.premium,
        nextDueDate: date.toISOString().split("T")[0] ?? "",
        daysUntilDue: daysBetween(referenceDate, date),
        insuredMemberName: policy.insuredMemberName ?? "未知",
        isSavings: isSavingsCategory(policy.category),
      });
    }
  }

  // Sort by due date
  return items.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * Group renewal items by month
 */
export function groupByMonth(items: RenewalItem[]): MonthlyRenewal[] {
  const monthMap = new Map<string, RenewalItem[]>();

  for (const item of items) {
    const month = item.nextDueDate.substring(0, 7); // YYYY-MM
    const existing = monthMap.get(month) ?? [];
    existing.push(item);
    monthMap.set(month, existing);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthItems]) => {
      const savingsItems = monthItems.filter((i) => i.isSavings);
      const protectionItems = monthItems.filter((i) => !i.isSavings);

      return {
        month,
        monthLabel: getMonthLabel(month),
        items: monthItems,
        totalPremium: monthItems.reduce((sum, i) => sum + i.premium, 0),
        savingsPremium: savingsItems.reduce((sum, i) => sum + i.premium, 0),
        protectionPremium: protectionItems.reduce((sum, i) => sum + i.premium, 0),
        count: monthItems.length,
      };
    });
}

/**
 * Calculate renewal summary
 */
export function calculateSummary(items: RenewalItem[]): RenewalSummary {
  const savingsItems = items.filter((i) => i.isSavings);
  const protectionItems = items.filter((i) => !i.isSavings);

  // Unique policies count
  const uniquePolicies = new Set(items.map((i) => i.id));

  return {
    totalPremium: items.reduce((sum, i) => sum + i.premium, 0),
    savingsPremium: savingsItems.reduce((sum, i) => sum + i.premium, 0),
    protectionPremium: protectionItems.reduce((sum, i) => sum + i.premium, 0),
    totalCount: uniquePolicies.size,
    renewalCount: items.length,
  };
}

/**
 * Build complete renewal calendar data
 */
export function buildRenewalCalendarData(
  policies: PolicyForRenewal[],
  referenceDate: Date = new Date(),
  monthsAhead: number = 12
): RenewalCalendarData {
  const items = calculateRenewalItems(policies, referenceDate, monthsAhead);
  const monthlyData = groupByMonth(items);
  const summary = calculateSummary(items);

  // Upcoming renewals (next 30 days)
  const upcomingRenewals = items.filter((i) => i.daysUntilDue <= 30);

  return {
    summary,
    monthlyData,
    upcomingRenewals,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return `¥${value.toLocaleString()}`;
}

/**
 * Fetch renewal calendar data from API
 */
export async function fetchRenewalCalendarData(): Promise<RenewalCalendarData> {
  const response = await fetch("/api/renewal-calendar");
  if (!response.ok) {
    throw new Error(`Failed to fetch renewal calendar: ${response.status}`);
  }
  return response.json();
}
