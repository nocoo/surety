/**
 * Member Coverage ViewModel
 * Provides data structures and helpers for the member coverage page
 */

import type { PolicyCategory } from "@/db/types";
import { CATEGORY_CONFIG, getCategoryConfig } from "./category-config";

// ============================================================================
// Types
// ============================================================================

export interface MemberForCoverage {
  id: number;
  name: string;
  relation: string;
  gender: string | null;
}

export interface PolicyForCoverage {
  id: number;
  productName: string;
  category: PolicyCategory;
  subCategory: string | null;
  sumAssured: number;
  premium: number;
  insurerName: string;
  insurerPhone: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  status: string;
}

export interface MemberCoverageCard {
  id: number;
  name: string;
  relation: string;
  relationLabel: string;
  gender: string | null;
  activePolicyCount: number;
  totalSumAssured: number;
}

export interface PolicyCoverageCard {
  id: number;
  productName: string;
  category: PolicyCategory;
  categoryLabel: string;
  categoryVariant: string;
  subCategory: string | null;
  sumAssured: number;
  sumAssuredFormatted: string;
  premium: number;
  premiumFormatted: string;
  insurerName: string;
  insurerPhone: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  status: string;
  statusLabel: string;
  isActive: boolean;
}

export interface CategoryGroup {
  category: PolicyCategory;
  categoryLabel: string;
  categoryVariant: string;
  policies: PolicyCoverageCard[];
  totalSumAssured: number;
  count: number;
}

export interface MemberCoverageData {
  members: MemberCoverageCard[];
  selectedMember: MemberCoverageCard | null;
  categoryGroups: CategoryGroup[];
}

// ============================================================================
// Constants
// ============================================================================

export const RELATION_LABELS: Record<string, string> = {
  Self: "本人",
  Spouse: "配偶",
  Child: "子女",
  Parent: "父母",
};

export const STATUS_LABELS: Record<string, string> = {
  Active: "生效中",
  Lapsed: "已失效",
  Surrendered: "已退保",
  Claimed: "已理赔",
};

// Category display order for the page
export const CATEGORY_ORDER: PolicyCategory[] = [
  "Accident",      // 意外险 - emergency focus
  "Medical",       // 医疗险
  "CriticalIllness", // 重疾险
  "Life",          // 寿险
  "Annuity",       // 年金险
  "Property",      // 财产险
];

// ============================================================================
// Pure calculation functions
// ============================================================================

/**
 * Format currency for display
 */
export function formatSumAssured(value: number): string {
  if (value >= 10000) {
    const wan = value / 10000;
    return wan % 1 === 0 ? `${wan}万` : `${wan.toFixed(1)}万`;
  }
  return value.toLocaleString();
}

/**
 * Format premium for display
 */
export function formatPremium(value: number): string {
  return `¥${value.toLocaleString()}`;
}

/**
 * Build member coverage cards from raw data
 */
export function buildMemberCards(
  members: MemberForCoverage[],
  policiesByMember: Map<number, PolicyForCoverage[]>
): MemberCoverageCard[] {
  return members.map((member) => {
    const policies = policiesByMember.get(member.id) ?? [];
    const activePolicies = policies.filter((p) => p.status === "Active");

    return {
      id: member.id,
      name: member.name,
      relation: member.relation,
      relationLabel: RELATION_LABELS[member.relation] ?? member.relation,
      gender: member.gender,
      activePolicyCount: activePolicies.length,
      totalSumAssured: activePolicies.reduce((sum, p) => sum + p.sumAssured, 0),
    };
  });
}

/**
 * Build policy coverage cards from raw policies
 */
export function buildPolicyCards(
  policies: PolicyForCoverage[]
): PolicyCoverageCard[] {
  return policies.map((policy) => {
    const config = getCategoryConfig(policy.category);

    return {
      id: policy.id,
      productName: policy.productName,
      category: policy.category,
      categoryLabel: config.label,
      categoryVariant: config.variant,
      subCategory: policy.subCategory,
      sumAssured: policy.sumAssured,
      sumAssuredFormatted: formatSumAssured(policy.sumAssured),
      premium: policy.premium,
      premiumFormatted: formatPremium(policy.premium),
      insurerName: policy.insurerName,
      insurerPhone: policy.insurerPhone,
      effectiveDate: policy.effectiveDate,
      expiryDate: policy.expiryDate,
      status: policy.status,
      statusLabel: STATUS_LABELS[policy.status] ?? policy.status,
      isActive: policy.status === "Active",
    };
  });
}

/**
 * Group policies by category, following the defined order
 */
export function groupPoliciesByCategory(
  policies: PolicyCoverageCard[]
): CategoryGroup[] {
  // Create a map of category -> policies
  const categoryMap = new Map<PolicyCategory, PolicyCoverageCard[]>();

  for (const policy of policies) {
    const existing = categoryMap.get(policy.category) ?? [];
    existing.push(policy);
    categoryMap.set(policy.category, existing);
  }

  // Build groups in the defined order
  const groups: CategoryGroup[] = [];

  for (const category of CATEGORY_ORDER) {
    const categoryPolicies = categoryMap.get(category);
    if (categoryPolicies && categoryPolicies.length > 0) {
      const config = CATEGORY_CONFIG[category];
      groups.push({
        category,
        categoryLabel: config.label,
        categoryVariant: config.variant,
        policies: categoryPolicies,
        totalSumAssured: categoryPolicies.reduce((sum, p) => sum + p.sumAssured, 0),
        count: categoryPolicies.length,
      });
    }
  }

  return groups;
}

/**
 * Build complete member coverage data
 */
export function buildMemberCoverageData(
  members: MemberForCoverage[],
  policiesByMember: Map<number, PolicyForCoverage[]>,
  selectedMemberId?: number
): MemberCoverageData {
  const memberCards = buildMemberCards(members, policiesByMember);

  // Select first member if not specified
  const effectiveSelectedId = selectedMemberId ?? memberCards[0]?.id;
  const selectedMember = memberCards.find((m) => m.id === effectiveSelectedId) ?? null;

  // Get policies for selected member
  const selectedPolicies = effectiveSelectedId
    ? policiesByMember.get(effectiveSelectedId) ?? []
    : [];

  const policyCards = buildPolicyCards(selectedPolicies);
  const categoryGroups = groupPoliciesByCategory(policyCards);

  return {
    members: memberCards,
    selectedMember,
    categoryGroups,
  };
}

/**
 * Fetch member coverage data from API
 */
export async function fetchMemberCoverageData(
  memberId?: number
): Promise<MemberCoverageData> {
  const url = memberId
    ? `/api/member-coverage?memberId=${memberId}`
    : "/api/member-coverage";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch member coverage: ${response.status}`);
  }
  return response.json();
}
