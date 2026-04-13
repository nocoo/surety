import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getR2ClientFromEnv } from "@/lib/r2-client";
import { deriveDisplayStatus, type PolicyDbStatus } from "@/db/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const policy = await repos.policies.findById(policyId);

  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const members = await repos.members.findAll();
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const assets = await repos.assets.findAll();
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
    applicantName: memberMap.get(policy.applicantId) ?? "未知",
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
    guaranteedRenewalYears: policy.guaranteedRenewalYears,
    status: deriveDisplayStatus(policy.status as PolicyDbStatus, policy.expiryDate),
    deathBenefit: policy.deathBenefit,
    policyFilePath: policy.policyFilePath,
    notes: policy.notes,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  // Check policy exists before any side effects (e.g. creating insurer)
  const existing = await repos.policies.findById(policyId);
  if (!existing) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  // Server-side normalization: enforce insuredType mutual exclusion.
  // When insuredType is "Member", clear insuredAssetId; when "Asset", clear insuredMemberId.
  let { insuredMemberId, insuredAssetId } = body;
  if (body.insuredType === "Member") {
    insuredAssetId = null;
  } else if (body.insuredType === "Asset") {
    insuredMemberId = null;
  }

  // Resolve insurer: find or create by name, persist both insurerId and insurerName
  const insurer = body.insurerName
    ? await repos.insurers.findOrCreate(body.insurerName)
    : null;

  const updated = await repos.policies.update(policyId, {
    applicantId: body.applicantId,
    insuredType: body.insuredType,
    insuredMemberId,
    insuredAssetId,
    category: body.category,
    subCategory: body.subCategory,
    ...(insurer && { insurerId: insurer.id, insurerName: insurer.name }),
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
    guaranteedRenewalYears: body.guaranteedRenewalYears,
    status: body.status,
    deathBenefit: body.deathBenefit,
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
  const { repos, targetDb, batchExecute } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const policy = await repos.policies.findById(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  // Collect R2 keys BEFORE deleting DB records (we need them for cleanup).
  // Also create R2 client eagerly so env-missing errors don't fire after DB delete.
  const policyAttachments = await repos.attachments.findByPolicyId(policyId);
  let r2Client: ReturnType<typeof getR2ClientFromEnv> | null = null;
  if (policyAttachments.length > 0) {
    try {
      r2Client = getR2ClientFromEnv(targetDb);
    } catch {
      // env vars missing — R2 cleanup will be skipped (orphan objects, harmless)
    }
  }

  // Cascade delete DB records first — this is the authoritative state.
  // D1 enforces foreign_keys=ON, so we must delete children before the policy.
  if (batchExecute) {
    await batchExecute([
      { sql: "DELETE FROM attachments WHERE policy_id = ?", params: [policyId] },
      { sql: "DELETE FROM beneficiaries WHERE policy_id = ?", params: [policyId] },
      { sql: "DELETE FROM payments WHERE policy_id = ?", params: [policyId] },
      { sql: "DELETE FROM cash_values WHERE policy_id = ?", params: [policyId] },
      { sql: "DELETE FROM coverage_items WHERE policy_id = ?", params: [policyId] },
      { sql: "DELETE FROM policies WHERE id = ?", params: [policyId] },
    ]);
  } else {
    // Non-batch path (test env or fallback)
    await repos.attachments.deleteByPolicyId(policyId);
    await repos.beneficiaries.deleteByPolicyId(policyId);
    await repos.payments.deleteByPolicyId(policyId);
    await repos.cashValues.deleteByPolicyId(policyId);
    await repos.coverageItems.deleteByPolicyId(policyId);
    await repos.policies.delete(policyId);
  }

  // Clean up R2 objects AFTER DB delete — best-effort.
  // If R2 cleanup fails, we have orphan R2 objects with no DB references (harmless,
  // only wastes storage). Wrapped in try/catch so R2 errors never turn a
  // successful DB delete into 500.
  if (r2Client) {
    try {
      await Promise.allSettled(
        policyAttachments.map((a) => r2Client.delete(a.r2Key)),
      );
    } catch {
      // allSettled itself shouldn't throw, but guard against unexpected errors
    }
  }

  return NextResponse.json({ success: true });
}
