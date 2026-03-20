import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { deriveDisplayStatus, type PolicyDbStatus } from "@/db/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { repos } = await getReposFromRequest();

  const policies = await repos.policies.findAll();
  const members = await repos.members.findAll();
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const assets = await repos.assets.findAll();
  const assetMap = new Map(assets.map((a) => [a.id, a.name]));

  const result = policies.map((p) => ({
    id: p.id,
    policyNumber: p.policyNumber,
    productName: p.productName,
    insurerName: p.insurerName,
    applicantId: p.applicantId,
    insuredMemberId: p.insuredMemberId,
    insuredName: p.insuredMemberId ? memberMap.get(p.insuredMemberId) ?? "未知" : "未知",
    insuredAssetId: p.insuredAssetId,
    insuredAssetName: p.insuredAssetId ? assetMap.get(p.insuredAssetId) ?? null : null,
    category: p.category,
    subCategory: p.subCategory,
    status: deriveDisplayStatus(p.status as PolicyDbStatus, p.expiryDate),
    premium: p.premium,
    sumAssured: p.sumAssured,
    nextDueDate: p.nextDueDate ?? p.effectiveDate,
    effectiveDate: p.effectiveDate,
    expiryDate: p.expiryDate,
    guaranteedRenewalYears: p.guaranteedRenewalYears,
    channel: p.channel,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { repos } = await getReposFromRequest();

  const body = await request.json();

  if (
    !body.applicantId ||
    !body.category ||
    !body.insurerName ||
    !body.productName ||
    !body.policyNumber ||
    !body.effectiveDate
  ) {
    return NextResponse.json(
      {
        error:
          "applicantId, category, insurerName, productName, policyNumber, effectiveDate are required",
      },
      { status: 400 }
    );
  }

  const policy = await repos.policies.create({
    applicantId: body.applicantId,
    insuredType: body.insuredType ?? "Member",
    insuredMemberId: body.insuredMemberId ?? null,
    insuredAssetId: body.insuredAssetId ?? null,
    category: body.category,
    subCategory: body.subCategory ?? null,
    insurerName: body.insurerName,
    productName: body.productName,
    policyNumber: body.policyNumber,
    channel: body.channel ?? null,
    sumAssured: body.sumAssured ?? 0,
    premium: body.premium ?? 0,
    paymentFrequency: body.paymentFrequency ?? "Yearly",
    paymentYears: body.paymentYears ?? null,
    totalPayments: body.totalPayments ?? null,
    renewalType: body.renewalType ?? null,
    paymentAccount: body.paymentAccount ?? null,
    nextDueDate: body.nextDueDate ?? null,
    effectiveDate: body.effectiveDate,
    expiryDate: body.expiryDate ?? null,
    hesitationEndDate: body.hesitationEndDate ?? null,
    waitingDays: body.waitingDays ?? null,
    guaranteedRenewalYears: body.guaranteedRenewalYears ?? null,
    status: body.status ?? "Active",
    deathBenefit: body.deathBenefit ?? null,
    policyFilePath: body.policyFilePath ?? null,
    notes: body.notes ?? null,
  });

  return NextResponse.json(
    {
      id: policy.id,
      policyNumber: policy.policyNumber,
      productName: policy.productName,
      insurerName: policy.insurerName,
      category: policy.category,
      status: policy.status,
    },
    { status: 201 }
  );
}
