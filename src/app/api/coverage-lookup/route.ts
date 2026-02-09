import { NextRequest, NextResponse } from "next/server";
import {
  buildMemberCoverageData,
  buildAssetCoverageData,
  type MemberForCoverage,
  type AssetForCoverage,
  type PolicyForCoverage,
  type SelectionType,
} from "@/lib/coverage-lookup-vm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { membersRepo, policiesRepo, insurersRepo, assetsRepo } = await import(
    "@/db/repositories"
  );

  // Get query params
  const searchParams = request.nextUrl.searchParams;
  const selectionType = (searchParams.get("type") ?? "member") as SelectionType;
  const idParam = searchParams.get("id");
  const selectedId = idParam ? parseInt(idParam, 10) : undefined;

  // Get all members
  const allMembers = membersRepo.findAll();
  const members: MemberForCoverage[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    relation: m.relation,
    gender: m.gender,
  }));

  // Get all assets
  const allAssets = assetsRepo.findAll();
  const assets: AssetForCoverage[] = allAssets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as "RealEstate" | "Vehicle",
    identifier: a.identifier,
  }));

  // Get all insurers for phone lookup
  const allInsurers = insurersRepo.findAll();
  const insurerPhoneMap = new Map<string, string | null>();
  for (const insurer of allInsurers) {
    insurerPhoneMap.set(insurer.name, insurer.phone);
  }

  // Get all policies and group by insured member/asset
  const allPolicies = policiesRepo.findAll();
  const policiesByMember = new Map<number, PolicyForCoverage[]>();
  const policiesByAsset = new Map<number, PolicyForCoverage[]>();

  for (const policy of allPolicies) {
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

    // Group by insured type
    if (policy.insuredType === "Member" && policy.insuredMemberId) {
      const existing = policiesByMember.get(policy.insuredMemberId) ?? [];
      existing.push(policyData);
      policiesByMember.set(policy.insuredMemberId, existing);
    } else if (policy.insuredType === "Asset" && policy.insuredAssetId) {
      const existing = policiesByAsset.get(policy.insuredAssetId) ?? [];
      existing.push(policyData);
      policiesByAsset.set(policy.insuredAssetId, existing);
    }
  }

  // Build the coverage data based on selection type
  const data = selectionType === "asset"
    ? buildAssetCoverageData(members, assets, policiesByMember, policiesByAsset, selectedId)
    : buildMemberCoverageData(members, assets, policiesByMember, policiesByAsset, selectedId);

  return NextResponse.json(data);
}
