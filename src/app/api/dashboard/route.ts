import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  Life: "寿险",
  CriticalIllness: "重疾险",
  Medical: "医疗险",
  Accident: "意外险",
  Annuity: "年金险",
  Property: "财产险",
};

export async function GET() {
  const { policiesRepo, membersRepo } = await import("@/db/repositories");
  const policies = policiesRepo.findAll();
  const members = membersRepo.findAll();

  const activePolicies = policies.filter((p) => p.status === "Active" && !p.archived);
  const totalPremium = activePolicies.reduce((sum, p) => sum + p.premium, 0);
  const totalSumAssured = activePolicies.reduce((sum, p) => sum + p.sumAssured, 0);
  const memberCount = members.length;
  const policyCount = activePolicies.length;

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  // Premium by category (for pie chart)
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

  // Premium by member (for bar chart)
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
  const premiumByMember = Array.from(memberPremiumMap.values())
    .sort((a, b) => b.premium - a.premium);

  // Policies by insurer (for horizontal bar)
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

  // Policies by channel (for pie chart)
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

  // Sum assured by category (for showing protection coverage)
  const coverageByCategory = premiumByCategory
    .filter((c) => c.sumAssured > 0)
    .map((c) => ({
      label: c.label,
      sumAssured: c.sumAssured,
    }))
    .sort((a, b) => b.sumAssured - a.sumAssured);

  // Member by category (for stacked bar chart - count based)
  const memberCategoryCountMap = new Map<number, Record<string, number>>();
  // Member by category - premium based
  const memberCategoryPremiumMap = new Map<number, Record<string, number>>();
  // Member by category - coverage based
  const memberCategoryCoverageMap = new Map<number, Record<string, number>>();
  
  for (const p of activePolicies) {
    if (p.insuredMemberId) {
      const categoryLabel = categoryLabels[p.category] ?? p.category;
      
      // Count
      const existingCount = memberCategoryCountMap.get(p.insuredMemberId) ?? {};
      existingCount[categoryLabel] = (existingCount[categoryLabel] ?? 0) + 1;
      memberCategoryCountMap.set(p.insuredMemberId, existingCount);
      
      // Premium
      const existingPremium = memberCategoryPremiumMap.get(p.insuredMemberId) ?? {};
      existingPremium[categoryLabel] = (existingPremium[categoryLabel] ?? 0) + p.premium;
      memberCategoryPremiumMap.set(p.insuredMemberId, existingPremium);
      
      // Coverage
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
  
  // Helper to build stacked data from a map
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

  // Renewal timeline (upcoming 12 months)
  const now = new Date();
  const renewalMap = new Map<string, { count: number; premium: number }>();
  const expiryMap = new Map<string, { count: number; premium: number }>();
  
  for (const p of activePolicies) {
    // Renewal: use effectiveDate to calculate next renewal month
    if (p.effectiveDate) {
      const effectiveDate = new Date(p.effectiveDate);
      // Calculate next renewal date (same month/day in current or next year)
      let nextRenewal = new Date(now.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate());
      if (nextRenewal <= now) {
        nextRenewal = new Date(now.getFullYear() + 1, effectiveDate.getMonth(), effectiveDate.getDate());
      }
      const monthKey = `${nextRenewal.getFullYear()}-${String(nextRenewal.getMonth() + 1).padStart(2, "0")}`;
      const existing = renewalMap.get(monthKey) ?? { count: 0, premium: 0 };
      renewalMap.set(monthKey, { count: existing.count + 1, premium: existing.premium + p.premium });
    }
    
    // Expiry: use expiryDate if available
    if (p.expiryDate) {
      const expiryDate = new Date(p.expiryDate);
      if (expiryDate >= now) {
        const monthKey = `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, "0")}`;
        const existing = expiryMap.get(monthKey) ?? { count: 0, premium: 0 };
        expiryMap.set(monthKey, { count: existing.count + 1, premium: existing.premium + p.premium });
      }
    }
  }
  
  const renewalTimeline = Array.from(renewalMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(0, 12);
    
  const expiryTimeline = Array.from(expiryMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(0, 12);

  return NextResponse.json({
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
  });
}
