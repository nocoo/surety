import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { deriveDisplayStatus, type PolicyDbStatus } from "@/db/types";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();

  const policies = await repos.policies.findAll();
  const members = await repos.members.findAll();
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const assets = await repos.assets.findAll();
  const assetMap = new Map(assets.map((a) => [a.id, a.name]));

  const attachmentCounts = await repos.attachments.countGroupedByPolicyIds(
    policies.map((p) => p.id),
  );

  const result = policies.map((p) => ({
    id: p.id,
    policyNumber: p.policyNumber,
    productName: p.productName,
    insurerName: p.insurerName,
    applicantId: p.applicantId,
    applicantName: memberMap.get(p.applicantId) ?? "未知",
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
    notes: p.notes,
    attachmentCount: attachmentCounts.get(p.id) ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
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

  // Validate applicant exists before any side effects (e.g. creating insurer)
  const applicant = await repos.members.findById(body.applicantId);
  if (!applicant) {
    return NextResponse.json({ error: "投保人不存在" }, { status: 400 });
  }

  // Server-side normalization: enforce insuredType mutual exclusion.
  // When insuredType is "Member", clear insuredAssetId; when "Asset", clear insuredMemberId.
  let insuredMemberId = body.insuredMemberId ?? null;
  let insuredAssetId = body.insuredAssetId ?? null;
  const insuredType = body.insuredType ?? "Member";
  if (insuredType === "Member") {
    insuredAssetId = null;
  } else if (insuredType === "Asset") {
    insuredMemberId = null;
  }

  // Resolve insurer and create policy inside try/catch so that:
  // 1. findOrCreate errors (unexpected DB failures) are caught
  // 2. Policy create failures trigger insurer rollback
  let insurer: Awaited<ReturnType<typeof repos.insurers.findOrCreate>> | null = null;
  try {
    insurer = await repos.insurers.findOrCreate(body.insurerName);

    const policy = await repos.policies.create({
      applicantId: body.applicantId,
      insuredType,
      insuredMemberId,
      insuredAssetId,
      category: body.category,
      subCategory: body.subCategory ?? null,
      insurerId: insurer.id,
      insurerName: insurer.name,
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
  } catch (err) {
    // Roll back newly created insurer to avoid orphan records
    if (insurer?.created) {
      await repos.insurers.delete(insurer.id).catch(() => {});
    }
    const message = err instanceof Error ? err.message : "";
    const isDuplicatePolicyNumber = message.includes("UNIQUE") && message.includes("policy_number");
    return NextResponse.json(
      { error: isDuplicatePolicyNumber ? "保单编号已存在" : "创建保单失败" },
      { status: isDuplicatePolicyNumber ? 409 : 500 }
    );
  }
}
