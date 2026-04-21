import { NextResponse } from "next/server";
import {
  buildRenewalCalendarData,
  type PolicyForRenewal,
} from "@surety/api/renewal-calendar";
import { getReposFromRequest } from "@/lib/api-helpers";
import { isEffectivelyActive, type PolicyDbStatus } from "@surety/db/types";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();

  const policies = await repos.policies.findAll();
  const members = await repos.members.findAll();

  const activePolicies = policies.filter(
    (p) => isEffectivelyActive(p.status as PolicyDbStatus, p.expiryDate)
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
