import { NextResponse } from "next/server";
import {
  buildRenewalCalendarData,
  type PolicyForRenewal,
} from "@/lib/renewal-calendar-vm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { policiesRepo, membersRepo } = await import("@/db/repositories");

  const policies = policiesRepo.findAll();
  const members = membersRepo.findAll();

  const activePolicies = policies.filter(
    (p) => p.status === "Active" && !p.archived
  );
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  // Transform to PolicyForRenewal format
  const policiesForRenewal: PolicyForRenewal[] = activePolicies.map((p) => ({
    id: p.id,
    productName: p.productName,
    category: p.category,
    subCategory: p.subCategory,
    premium: p.premium,
    paymentFrequency: p.paymentFrequency,
    nextDueDate: p.nextDueDate,
    insuredMemberName: p.insuredMemberId
      ? (memberMap.get(p.insuredMemberId) ?? "未知")
      : "未知",
  }));

  // Build renewal calendar data using pure functions from ViewModel
  const data = buildRenewalCalendarData(policiesForRenewal, new Date(), 12);

  return NextResponse.json(data);
}
