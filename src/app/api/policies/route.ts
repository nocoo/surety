import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { policiesRepo, membersRepo } = await import("@/db/repositories");
  
  const policies = policiesRepo.findAll();
  const members = membersRepo.findAll();
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const result = policies.map((p) => ({
    id: p.id,
    policyNumber: p.policyNumber,
    productName: p.productName,
    insurerName: p.insurerName,
    insuredName: p.insuredMemberId ? memberMap.get(p.insuredMemberId) ?? "未知" : "未知",
    category: p.category,
    subCategory: p.subCategory,
    status: p.status,
    premium: p.premium,
    sumAssured: p.sumAssured,
    nextDueDate: p.nextDueDate ?? p.effectiveDate,
    effectiveDate: p.effectiveDate,
    expiryDate: p.expiryDate,
    channel: p.channel,
    archived: p.archived,
  }));

  return NextResponse.json(result);
}
