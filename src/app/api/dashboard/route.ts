import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { policiesRepo, membersRepo } = await import("@/db/repositories");
  const policies = policiesRepo.findAll();
  const members = membersRepo.findAll();

  const activePolicies = policies.filter((p) => p.status === "Active" && !p.archived);
  const totalPremium = activePolicies.reduce((sum, p) => sum + p.premium, 0);
  const memberCount = members.length;
  const policyCount = activePolicies.length;

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const upcomingRenewals = activePolicies
    .filter((p) => p.nextDueDate || p.expiryDate)
    .map((p) => ({
      id: p.id,
      productName: p.productName,
      insuredName: p.insuredMemberId ? memberMap.get(p.insuredMemberId) ?? "未知" : "未知",
      dueDate: p.nextDueDate ?? p.expiryDate ?? p.effectiveDate,
    }))
    .slice(0, 5);

  return NextResponse.json({
    stats: {
      policyCount,
      memberCount,
      totalPremium,
    },
    upcomingRenewals,
  });
}
