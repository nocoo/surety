import { NextRequest, NextResponse } from "next/server";
import {
  buildMemberCoverageData,
  type MemberForCoverage,
  type PolicyForCoverage,
} from "@/lib/member-coverage-vm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { membersRepo, policiesRepo, insurersRepo } = await import(
    "@/db/repositories"
  );

  // Get optional memberId from query params
  const searchParams = request.nextUrl.searchParams;
  const memberIdParam = searchParams.get("memberId");
  const selectedMemberId = memberIdParam ? parseInt(memberIdParam, 10) : undefined;

  // Get all members
  const allMembers = membersRepo.findAll();
  const members: MemberForCoverage[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    relation: m.relation,
    gender: m.gender,
  }));

  // Get all insurers for phone lookup
  const allInsurers = insurersRepo.findAll();
  const insurerPhoneMap = new Map<string, string | null>();
  for (const insurer of allInsurers) {
    insurerPhoneMap.set(insurer.name, insurer.phone);
  }

  // Get all policies and group by insured member
  const allPolicies = policiesRepo.findAll();
  const policiesByMember = new Map<number, PolicyForCoverage[]>();

  for (const policy of allPolicies) {
    // Only include Member type policies (not Asset)
    if (policy.insuredType !== "Member" || !policy.insuredMemberId) {
      continue;
    }

    const policyData: PolicyForCoverage = {
      id: policy.id,
      productName: policy.productName,
      category: policy.category as PolicyForCoverage["category"],
      subCategory: policy.subCategory,
      sumAssured: policy.sumAssured,
      premium: policy.premium,
      insurerName: policy.insurerName,
      insurerPhone: insurerPhoneMap.get(policy.insurerName) ?? null,
      effectiveDate: policy.effectiveDate,
      expiryDate: policy.expiryDate,
      status: policy.status,
    };

    const existing = policiesByMember.get(policy.insuredMemberId) ?? [];
    existing.push(policyData);
    policiesByMember.set(policy.insuredMemberId, existing);
  }

  // Build the coverage data
  const data = buildMemberCoverageData(members, policiesByMember, selectedMemberId);

  return NextResponse.json(data);
}
