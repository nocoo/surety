import { isEffectivelyActive, type PolicyDbStatus } from "@/db/types";
import { parseLocalDate } from "@/lib/date-utils";
import type { AllRepos } from "@/db/repositories";

const categoryLabels: Record<string, string> = {
  Life: "寿险",
  CriticalIllness: "重疾险",
  Medical: "医疗险",
  Accident: "意外险",
  Annuity: "年金险",
  Property: "财产险",
};

export async function getDashboardData(repos: AllRepos) {
  const policies = await repos.policies.findAll();
  const members = await repos.members.findAll();

  const activePolicies = policies.filter(
    (p) => isEffectivelyActive(p.status as PolicyDbStatus, p.expiryDate)
  );
  const totalPremium = activePolicies.reduce((sum, p) => sum + p.premium, 0);
  const totalSumAssured = activePolicies.reduce((sum, p) => sum + p.sumAssured, 0);
  const memberCount = members.length;
  const policyCount = activePolicies.length;

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const categoryMap = new Map<string, { count: number; premium: number; sumAssured: number }>();
  for (const p of activePolicies) {
    const existing = categoryMap.get(p.category) ?? { count: 0, premium: 0, sumAssured: 0 };
    categoryMap.set(p.category, {
      count: existing.count + 1,
      premium: existing.premium + p.premium,
      sumAssured: existing.sumAssured + p.sumAssured,
    });
  }
  const premiumByCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      label: categoryLabels[category] ?? category,
      ...data,
    }))
    .sort((a, b) => b.premium - a.premium);

  const memberPremiumMap = new Map<number, { name: string; premium: number; count: number }>();
  for (const p of activePolicies) {
    if (p.insuredMemberId) {
      const existing = memberPremiumMap.get(p.insuredMemberId);
      const name = memberMap.get(p.insuredMemberId) ?? "未知";
      if (existing) {
        existing.premium += p.premium;
        existing.count += 1;
      } else {
        memberPremiumMap.set(p.insuredMemberId, { name, premium: p.premium, count: 1 });
      }
    }
  }
  const premiumByMember = Array.from(memberPremiumMap.values()).sort((a, b) => b.premium - a.premium);

  const insurerMap = new Map<string, { count: number; premium: number }>();
  for (const p of activePolicies) {
    const existing = insurerMap.get(p.insurerName) ?? { count: 0, premium: 0 };
    insurerMap.set(p.insurerName, {
      count: existing.count + 1,
      premium: existing.premium + p.premium,
    });
  }
  const policyByInsurer = Array.from(insurerMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const channelMap = new Map<string, { count: number; premium: number }>();
  for (const p of activePolicies) {
    const channel = p.channel || "未知";
    const existing = channelMap.get(channel) ?? { count: 0, premium: 0 };
    channelMap.set(channel, {
      count: existing.count + 1,
      premium: existing.premium + p.premium,
    });
  }
  const policyByChannel = Array.from(channelMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.premium - a.premium);

  const coverageByCategory = premiumByCategory
    .filter((c) => c.sumAssured > 0)
    .map((c) => ({
      label: c.label,
      sumAssured: c.sumAssured,
    }))
    .sort((a, b) => b.sumAssured - a.sumAssured);

  const memberCategoryCountMap = new Map<number, Record<string, number>>();
  const memberCategoryPremiumMap = new Map<number, Record<string, number>>();
  const memberCategoryCoverageMap = new Map<number, Record<string, number>>();

  for (const p of activePolicies) {
    if (p.insuredMemberId) {
      const categoryLabel = categoryLabels[p.category] ?? p.category;

      const existingCount = memberCategoryCountMap.get(p.insuredMemberId) ?? {};
      existingCount[categoryLabel] = (existingCount[categoryLabel] ?? 0) + 1;
      memberCategoryCountMap.set(p.insuredMemberId, existingCount);

      const existingPremium = memberCategoryPremiumMap.get(p.insuredMemberId) ?? {};
      existingPremium[categoryLabel] = (existingPremium[categoryLabel] ?? 0) + p.premium;
      memberCategoryPremiumMap.set(p.insuredMemberId, existingPremium);

      const existingCoverage = memberCategoryCoverageMap.get(p.insuredMemberId) ?? {};
      existingCoverage[categoryLabel] = (existingCoverage[categoryLabel] ?? 0) + p.sumAssured;
      memberCategoryCoverageMap.set(p.insuredMemberId, existingCoverage);
    }
  }

  const allCategories = new Set<string>();
  memberCategoryCountMap.forEach((categories) => {
    Object.keys(categories).forEach((c) => allCategories.add(c));
  });
  const sortedCategories = Array.from(allCategories).sort();

  const buildStackedData = (map: Map<number, Record<string, number>>) =>
    Array.from(map.entries())
      .map(([memberId, categories]) => ({
        name: memberMap.get(memberId) ?? "未知",
        ...categories,
      }))
      .sort((a, b) => {
        const totalA = Object.values(a).filter((v) => typeof v === "number").reduce((s, n) => s + n, 0);
        const totalB = Object.values(b).filter((v) => typeof v === "number").reduce((s, n) => s + n, 0);
        return totalB - totalA;
      });

  const memberByCategory = {
    data: buildStackedData(memberCategoryCountMap),
    categories: sortedCategories,
  };

  const memberPremiumByCategory = {
    data: buildStackedData(memberCategoryPremiumMap),
    categories: sortedCategories,
  };

  const memberCoverageByCategory = {
    data: buildStackedData(memberCategoryCoverageMap),
    categories: sortedCategories,
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const next12Months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(currentYear, currentMonth + i, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    next12Months.push(key);
  }

  const renewalByCategoryMap = new Map<string, Record<string, number>>();
  next12Months.forEach((month) => renewalByCategoryMap.set(month, {}));

  for (const p of activePolicies) {
    if (p.effectiveDate) {
      const effectiveDate = parseLocalDate(p.effectiveDate);
      let nextRenewal = new Date(now.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate());
      if (nextRenewal <= now) {
        nextRenewal = new Date(now.getFullYear() + 1, effectiveDate.getMonth(), effectiveDate.getDate());
      }
      const monthKey = `${nextRenewal.getFullYear()}-${String(nextRenewal.getMonth() + 1).padStart(2, "0")}`;

      if (next12Months.includes(monthKey)) {
        const categoryLabel = categoryLabels[p.category] ?? p.category;
        const existing = renewalByCategoryMap.get(monthKey) ?? {};
        existing[categoryLabel] = (existing[categoryLabel] ?? 0) + 1;
        renewalByCategoryMap.set(monthKey, existing);
      }
    }
  }

  const renewalCategories = new Set<string>();
  renewalByCategoryMap.forEach((categories) => {
    Object.keys(categories).forEach((c) => renewalCategories.add(c));
  });

  const renewalTimeline = {
    data: next12Months.map((month) => ({
      month,
      label: `${parseInt(month.split("-")[1] ?? "1")}月`,
      ...renewalByCategoryMap.get(month),
    })),
    categories: Array.from(renewalCategories).sort(),
  };

  const oneMonthLater = new Date(currentYear, currentMonth + 1, now.getDate());
  const threeMonthsLater = new Date(currentYear, currentMonth + 3, now.getDate());
  const sixMonthsLater = new Date(currentYear, currentMonth + 6, now.getDate());

  const expiryPeriods = [
    { key: "1month", label: "1个月内", maxDate: oneMonthLater },
    { key: "3months", label: "3个月内", maxDate: threeMonthsLater },
    { key: "6months", label: "6个月内", maxDate: sixMonthsLater },
  ];

  const expiryByCategoryMap = new Map<string, Record<string, number>>();
  expiryPeriods.forEach((period) => expiryByCategoryMap.set(period.key, {}));

  for (const p of activePolicies) {
    if (p.expiryDate) {
      const expiryDate = parseLocalDate(p.expiryDate);
      if (expiryDate < now) continue;

      const categoryLabel = categoryLabels[p.category] ?? p.category;

      for (const period of expiryPeriods) {
        if (expiryDate <= period.maxDate) {
          const existing = expiryByCategoryMap.get(period.key) ?? {};
          existing[categoryLabel] = (existing[categoryLabel] ?? 0) + 1;
          expiryByCategoryMap.set(period.key, existing);
          break;
        }
      }
    }
  }

  const expiryCategories = new Set<string>();
  expiryByCategoryMap.forEach((categories) => {
    Object.keys(categories).forEach((c) => expiryCategories.add(c));
  });

  const expiryTimeline = {
    data: expiryPeriods.map((period) => ({
      period: period.key,
      label: period.label,
      ...expiryByCategoryMap.get(period.key),
    })),
    categories: Array.from(expiryCategories).sort(),
  };

  return {
    stats: {
      policyCount,
      memberCount,
      totalPremium,
      totalSumAssured,
    },
    charts: {
      premiumByCategory,
      premiumByMember,
      policyByInsurer,
      policyByChannel,
      coverageByCategory,
      memberByCategory,
      memberPremiumByCategory,
      memberCoverageByCategory,
      renewalTimeline,
      expiryTimeline,
    },
  };
}
