import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  const records = await repos.beneficiaries.findByPolicyId(policyId);
  const members = await repos.members.findAll();
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const beneficiaries = records.map((b) => ({
    id: b.id,
    policyId: b.policyId,
    memberId: b.memberId,
    name: b.memberId ? memberMap.get(b.memberId) ?? b.externalName ?? "未知" : b.externalName ?? "未知",
    externalIdCard: b.externalIdCard,
    sharePercent: b.sharePercent,
    rankOrder: b.rankOrder,
  }));

  return NextResponse.json(beneficiaries);
}
