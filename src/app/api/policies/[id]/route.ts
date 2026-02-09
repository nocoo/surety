import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { deriveDisplayStatus, type PolicyDbStatus } from "@/db/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { policiesRepo, membersRepo, assetsRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const policy = policiesRepo.findById(policyId);

  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const members = membersRepo.findAll();
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const assets = assetsRepo.findAll();
  const assetMap = new Map(assets.map((a) => [a.id, a.name]));

  return NextResponse.json({
    id: policy.id,
    policyNumber: policy.policyNumber,
    productName: policy.productName,
    insurerName: policy.insurerName,
    insuredName: policy.insuredMemberId
      ? memberMap.get(policy.insuredMemberId) ?? "未知"
      : "未知",
    insuredAssetName: policy.insuredAssetId
      ? assetMap.get(policy.insuredAssetId) ?? null
      : null,
    applicantId: policy.applicantId,
    insuredType: policy.insuredType,
    insuredMemberId: policy.insuredMemberId,
    insuredAssetId: policy.insuredAssetId,
    category: policy.category,
    subCategory: policy.subCategory,
    channel: policy.channel,
    sumAssured: policy.sumAssured,
    premium: policy.premium,
    paymentFrequency: policy.paymentFrequency,
    paymentYears: policy.paymentYears,
    totalPayments: policy.totalPayments,
    renewalType: policy.renewalType,
    paymentAccount: policy.paymentAccount,
    nextDueDate: policy.nextDueDate,
    effectiveDate: policy.effectiveDate,
    expiryDate: policy.expiryDate,
    hesitationEndDate: policy.hesitationEndDate,
    waitingDays: policy.waitingDays,
    status: deriveDisplayStatus(policy.status as PolicyDbStatus, policy.expiryDate),
    deathBenefit: policy.deathBenefit,
    archived: policy.archived,
    policyFilePath: policy.policyFilePath,
    notes: policy.notes,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { policiesRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  const updated = policiesRepo.update(policyId, {
    applicantId: body.applicantId,
    insuredType: body.insuredType,
    insuredMemberId: body.insuredMemberId,
    insuredAssetId: body.insuredAssetId,
    category: body.category,
    subCategory: body.subCategory,
    insurerName: body.insurerName,
    productName: body.productName,
    policyNumber: body.policyNumber,
    channel: body.channel,
    sumAssured: body.sumAssured,
    premium: body.premium,
    paymentFrequency: body.paymentFrequency,
    paymentYears: body.paymentYears,
    totalPayments: body.totalPayments,
    renewalType: body.renewalType,
    paymentAccount: body.paymentAccount,
    nextDueDate: body.nextDueDate,
    effectiveDate: body.effectiveDate,
    expiryDate: body.expiryDate,
    hesitationEndDate: body.hesitationEndDate,
    waitingDays: body.waitingDays,
    status: body.status,
    deathBenefit: body.deathBenefit,
    archived: body.archived,
    policyFilePath: body.policyFilePath,
    notes: body.notes,
  });

  if (!updated) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    policyNumber: updated.policyNumber,
    productName: updated.productName,
    insurerName: updated.insurerName,
    category: updated.category,
    status: updated.status,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { policiesRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = policiesRepo.delete(policyId);

  if (!deleted) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
