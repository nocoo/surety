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

  // Policies by year (for trend line)
  const yearMap = new Map<string, { count: number; premium: number }>();
  for (const p of activePolicies) {
    const year = p.effectiveDate.substring(0, 4);
    const existing = yearMap.get(year) ?? { count: 0, premium: 0 };
    yearMap.set(year, {
      count: existing.count + 1,
      premium: existing.premium + p.premium,
    });
  }
  const policyByYear = Array.from(yearMap.entries())
    .map(([year, data]) => ({ year, ...data }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Member by category (for stacked bar chart)
  const memberCategoryMap = new Map<number, Record<string, number>>();
  for (const p of activePolicies) {
    if (p.insuredMemberId) {
      const existing = memberCategoryMap.get(p.insuredMemberId) ?? {};
      const categoryLabel = categoryLabels[p.category] ?? p.category;
      existing[categoryLabel] = (existing[categoryLabel] ?? 0) + 1;
      memberCategoryMap.set(p.insuredMemberId, existing);
    }
  }
  const allCategories = new Set<string>();
  memberCategoryMap.forEach((categories) => {
    Object.keys(categories).forEach((c) => allCategories.add(c));
  });
  const memberByCategory = {
    data: Array.from(memberCategoryMap.entries())
      .map(([memberId, categories]) => ({
        name: memberMap.get(memberId) ?? "未知",
        ...categories,
      }))
      .sort((a, b) => {
        const totalA = Object.values(a).filter((v) => typeof v === "number").reduce((s, n) => s + n, 0);
        const totalB = Object.values(b).filter((v) => typeof v === "number").reduce((s, n) => s + n, 0);
        return totalB - totalA;
      }),
    categories: Array.from(allCategories).sort(),
  };

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
      policyByYear,
      memberByCategory,
    },
  });
}
