import { Hono } from "hono";
import { deriveDisplayStatus, type PolicyDbStatus } from "@surety/db/types";
import { generatePaymentRecords } from "@surety/db/lib/generate-payments";
import {
  parseLocalDate,
  endOfYearInTimeZone,
  formatLocalDate,
  todayInTimeZone,
} from "@surety/db/lib/date-utils";
import { validateFile, validateMagicBytes, generateR2Key, MAX_ATTACHMENTS_PER_POLICY } from "@surety/api/lib/attachment-validation";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

const TERMINAL_STATUSES = ["Surrendered", "Claimed", "Lapsed"] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

const ALL_STATUSES = ["Active", ...TERMINAL_STATUSES] as const;
type DbStatus = (typeof ALL_STATUSES)[number];

const STATUS_METADATA_FIELDS = [
  "terminatedAt",
  "terminationReason",
  "plannedSurrenderAt",
  "plannedSurrenderNote",
] as const;

function isTerminalStatus(s: unknown): s is TerminalStatus {
  return typeof s === "string" && (TERMINAL_STATUSES as readonly string[]).includes(s);
}

function isValidDbStatus(s: unknown): s is DbStatus {
  return typeof s === "string" && (ALL_STATUSES as readonly string[]).includes(s);
}

/**
 * Strict ISO date validator. Returns true only when the input is exactly
 * "YYYY-MM-DD" and survives a parse/format round-trip — guards against
 * `parseLocalDate("2026-99-99")` silently rolling over.
 */
function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return formatLocalDate(parseLocalDate(s)) === s;
}

function bodyHasStatusMetadata(body: Record<string, unknown>): boolean {
  return STATUS_METADATA_FIELDS.some((f) => body[f] !== undefined);
}

// -- List policies --
app.get("/api/policies", async (c) => {
  const repos = c.get("repos");
  const policies = await repos.policies.findAll();
  const members = await repos.members.findAll();
  const memberMap = new Map(members.map((m: { id: number; name: string }) => [m.id, m.name]));
  const assets = await repos.assets.findAll();
  const assetMap = new Map(assets.map((a: { id: number; name: string }) => [a.id, a.name]));
  const attachmentCounts = await repos.attachments.countGroupedByPolicyIds(policies.map((p: { id: number }) => p.id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = policies.map((p: any) => ({
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
    nextDueDate: p.nextDueDate ?? null,
    effectiveDate: p.effectiveDate,
    expiryDate: p.expiryDate,
    guaranteedRenewalYears: p.guaranteedRenewalYears,
    channel: p.channel,
    notes: p.notes,
    attachmentCount: attachmentCounts.get(p.id) ?? 0,
  }));

  return c.json(result);
});

// -- Create policy --
app.post("/api/policies", async (c) => {
  const repos = c.get("repos");
  const body = await c.req.json();

  if (!body.applicantId || !body.category || !body.insurerName || !body.productName || !body.policyNumber || !body.effectiveDate) {
    return c.json({ error: "applicantId, category, insurerName, productName, policyNumber, effectiveDate are required" }, 400);
  }

  if (isTerminalStatus(body.status)) {
    return c.json({ error: "Cannot create a policy in a terminated state — use POST /api/policies/:id/terminate after creation" }, 400);
  }

  if (bodyHasStatusMetadata(body)) {
    return c.json({ error: "Cannot set termination or planned-surrender metadata on create — use the dedicated transition endpoints after creation" }, 400);
  }

  const applicant = await repos.members.findById(body.applicantId);
  if (!applicant) return c.json({ error: "投保人不存在" }, 400);

  if (body.status !== undefined && !isValidDbStatus(body.status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  let insuredMemberId = body.insuredMemberId ?? null;
  let insuredAssetId = body.insuredAssetId ?? null;
  const insuredType = body.insuredType ?? "Member";
  if (insuredType === "Member") insuredAssetId = null;
  else if (insuredType === "Asset") insuredMemberId = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let insurer: any = null;
  try {
    insurer = await repos.insurers.findOrCreate(body.insurerName);
    const policy = await repos.policies.create({
      applicantId: body.applicantId, insuredType, insuredMemberId, insuredAssetId,
      category: body.category, subCategory: body.subCategory ?? null,
      insurerId: insurer.id, insurerName: insurer.name,
      productName: body.productName, policyNumber: body.policyNumber,
      channel: body.channel ?? null, sumAssured: body.sumAssured ?? 0,
      premium: body.premium ?? 0, paymentFrequency: body.paymentFrequency ?? "Yearly",
      paymentYears: body.paymentYears ?? null, totalPayments: body.totalPayments ?? null,
      renewalType: body.renewalType ?? null, paymentAccount: body.paymentAccount ?? null,
      nextDueDate: body.nextDueDate ?? null, effectiveDate: body.effectiveDate,
      expiryDate: body.expiryDate ?? null, hesitationEndDate: body.hesitationEndDate ?? null,
      waitingDays: body.waitingDays ?? null, guaranteedRenewalYears: body.guaranteedRenewalYears ?? null,
      status: body.status ?? "Active", deathBenefit: body.deathBenefit ?? null,
      policyFilePath: body.policyFilePath ?? null, notes: body.notes ?? null,
    });
    return c.json({ id: policy.id, policyNumber: policy.policyNumber, productName: policy.productName, insurerName: policy.insurerName, category: policy.category, status: policy.status }, 201);
  } catch (err) {
    if (insurer?.created) await repos.insurers.delete(insurer.id).catch(() => {});
    const message = err instanceof Error ? err.message : "";
    const isDupe = message.includes("UNIQUE") && message.includes("policy_number");
    return c.json({ error: isDupe ? "保单编号已存在" : "创建保单失败" }, isDupe ? 409 : 500);
  }
});

// -- Get policy --
app.get("/api/policies/:id", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid id" }, 400);

  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);

  const members = await repos.members.findAll();
  const memberMap = new Map(members.map((m: { id: number; name: string }) => [m.id, m.name]));
  const assets = await repos.assets.findAll();
  const assetMap = new Map(assets.map((a: { id: number; name: string }) => [a.id, a.name]));

  return c.json({
    id: policy.id, policyNumber: policy.policyNumber, productName: policy.productName,
    insurerName: policy.insurerName,
    insuredName: policy.insuredMemberId ? memberMap.get(policy.insuredMemberId) ?? "未知" : "未知",
    insuredAssetName: policy.insuredAssetId ? assetMap.get(policy.insuredAssetId) ?? null : null,
    applicantId: policy.applicantId, applicantName: memberMap.get(policy.applicantId) ?? "未知",
    insuredType: policy.insuredType, insuredMemberId: policy.insuredMemberId,
    insuredAssetId: policy.insuredAssetId, category: policy.category,
    subCategory: policy.subCategory, channel: policy.channel,
    sumAssured: policy.sumAssured, premium: policy.premium,
    paymentFrequency: policy.paymentFrequency, paymentYears: policy.paymentYears,
    totalPayments: policy.totalPayments, renewalType: policy.renewalType,
    paymentAccount: policy.paymentAccount, nextDueDate: policy.nextDueDate,
    effectiveDate: policy.effectiveDate, expiryDate: policy.expiryDate,
    hesitationEndDate: policy.hesitationEndDate, waitingDays: policy.waitingDays,
    guaranteedRenewalYears: policy.guaranteedRenewalYears,
    status: deriveDisplayStatus(policy.status as PolicyDbStatus, policy.expiryDate),
    deathBenefit: policy.deathBenefit, policyFilePath: policy.policyFilePath, notes: policy.notes,
    terminatedAt: policy.terminatedAt ?? null,
    terminationReason: policy.terminationReason ?? null,
    plannedSurrenderAt: policy.plannedSurrenderAt ?? null,
    plannedSurrenderNote: policy.plannedSurrenderNote ?? null,
  });
});

// -- Update policy --
app.put("/api/policies/:id", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid id" }, 400);

  const body = await c.req.json();
  const existing = await repos.policies.findById(policyId);
  if (!existing) return c.json({ error: "Policy not found" }, 404);

  // Status / metadata bypass guards. Order is fixed (see docs/19-policy-status.md
  // §通用-post--put-禁写非-active-状态旁路封堵):
  //   1. Reactivation (status=Active from a terminal DB status)
  //   2a. Status enum validation
  //   2b. Terminal-status write intercept (different terminal OR same terminal)
  //   3. Status-metadata field intercept
  //   4. Normal update
  const existingIsTerminal = isTerminalStatus(existing.status);
  const isReactivation = body.status === "Active" && existingIsTerminal;
  if (!isReactivation) {
    if (body.status !== undefined && !isValidDbStatus(body.status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    if (isTerminalStatus(body.status)) {
      // Different terminal → cross-terminal transition forbidden.
      // Same terminal → metadata edits must go through POST /terminate.
      const msg = body.status !== existing.status
        ? "Use POST /api/policies/:id/terminate to transition into a terminal status"
        : "Use POST /api/policies/:id/terminate to edit termination metadata";
      return c.json({ error: msg }, 400);
    }
    if (bodyHasStatusMetadata(body)) {
      return c.json({ error: "Cannot modify status metadata via PUT — use the dedicated transition endpoints" }, 400);
    }
  }

  let { insuredMemberId, insuredAssetId } = body;
  if (body.insuredType === "Member") insuredAssetId = null;
  else if (body.insuredType === "Asset") insuredMemberId = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let insurer: any = null;
  try {
    insurer = body.insurerName ? await repos.insurers.findOrCreate(body.insurerName) : null;
    const updated = await repos.policies.update(policyId, {
      applicantId: body.applicantId, insuredType: body.insuredType,
      insuredMemberId, insuredAssetId, category: body.category,
      subCategory: body.subCategory,
      ...(insurer && { insurerId: insurer.id, insurerName: insurer.name }),
      productName: body.productName, policyNumber: body.policyNumber,
      channel: body.channel, sumAssured: body.sumAssured, premium: body.premium,
      paymentFrequency: body.paymentFrequency, paymentYears: body.paymentYears,
      totalPayments: body.totalPayments, renewalType: body.renewalType,
      paymentAccount: body.paymentAccount, nextDueDate: body.nextDueDate,
      effectiveDate: body.effectiveDate, expiryDate: body.expiryDate,
      hesitationEndDate: body.hesitationEndDate, waitingDays: body.waitingDays,
      guaranteedRenewalYears: body.guaranteedRenewalYears, status: body.status,
      deathBenefit: body.deathBenefit, policyFilePath: body.policyFilePath, notes: body.notes,
      // Reactivation force-clears all status metadata, regardless of body.
      ...(isReactivation && {
        terminatedAt: null,
        terminationReason: null,
        plannedSurrenderAt: null,
        plannedSurrenderNote: null,
      }),
    });
    if (!updated) {
      if (insurer?.created) await repos.insurers.delete(insurer.id).catch(() => {});
      return c.json({ error: "Policy not found" }, 404);
    }
    return c.json({ id: updated.id, policyNumber: updated.policyNumber, productName: updated.productName, insurerName: updated.insurerName, category: updated.category, status: updated.status });
  } catch (err) {
    if (insurer?.created) await repos.insurers.delete(insurer.id).catch(() => {});
    const message = err instanceof Error ? err.message : "";
    const isDupe = message.includes("UNIQUE") && message.includes("policy_number");
    return c.json({ error: isDupe ? "保单编号已存在" : "更新保单失败" }, isDupe ? 409 : 500);
  }
});

// -- Terminate policy (Surrendered / Claimed / Lapsed) --
app.post("/api/policies/:id/terminate", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid id" }, 400);

  const existing = await repos.policies.findById(policyId);
  if (!existing) return c.json({ error: "Policy not found" }, 404);

  const body = await c.req.json();
  const { status, terminatedAt, terminationReason } = body as {
    status?: unknown;
    terminatedAt?: unknown;
    terminationReason?: unknown;
  };

  // Terminal-status validity. Uses DB status (not display) so an expired
  // Active policy can still flow through terminate.
  if (!isTerminalStatus(status)) {
    return c.json({ error: "Invalid termination status" }, 400);
  }
  if (isTerminalStatus(existing.status) && existing.status !== status) {
    return c.json({ error: "Cannot transition between terminal statuses; reactivate to Active first" }, 400);
  }

  if (!isValidIsoDate(terminatedAt)) {
    return c.json({ error: "Invalid terminatedAt" }, 400);
  }
  if (terminatedAt < existing.effectiveDate) {
    return c.json({ error: "Terminated date must be on or after effective date" }, 400);
  }
  const today = todayInTimeZone("Asia/Shanghai");
  if (terminatedAt > today) {
    return c.json({ error: "Terminated date cannot be in the future" }, 400);
  }

  if (terminationReason !== undefined && terminationReason !== null) {
    if (typeof terminationReason !== "string") {
      return c.json({ error: "Reason too long" }, 400);
    }
    if (terminationReason.length > 500) {
      return c.json({ error: "Reason too long" }, 400);
    }
  }

  const updated = await repos.policies.update(policyId, {
    status,
    terminatedAt,
    terminationReason: typeof terminationReason === "string" ? terminationReason : null,
    // Termination satisfies any standing planned-surrender intent.
    plannedSurrenderAt: null,
    plannedSurrenderNote: null,
  });
  if (!updated) return c.json({ error: "Policy not found" }, 404);
  return c.json({
    id: updated.id,
    status: updated.status,
    terminatedAt: updated.terminatedAt,
    terminationReason: updated.terminationReason ?? null,
  });
});

// -- Planned surrender (UI-only marker on Active policies) --
app.put("/api/policies/:id/planned-surrender", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid id" }, 400);

  const existing = await repos.policies.findById(policyId);
  if (!existing) return c.json({ error: "Policy not found" }, 404);

  if (existing.status !== "Active") {
    return c.json({ error: "Planned surrender can only be set on Active policies" }, 400);
  }

  const body = await c.req.json();
  const { plannedSurrenderAt, plannedSurrenderNote } = body as {
    plannedSurrenderAt?: unknown;
    plannedSurrenderNote?: unknown;
  };

  if (plannedSurrenderAt !== null) {
    if (!isValidIsoDate(plannedSurrenderAt)) {
      return c.json({ error: "Invalid plannedSurrenderAt" }, 400);
    }
    if (plannedSurrenderAt < existing.effectiveDate) {
      return c.json({ error: "Planned surrender date must be on or after effective date" }, 400);
    }
  }

  let normalizedNote: string | null = null;
  if (plannedSurrenderNote !== undefined && plannedSurrenderNote !== null) {
    if (typeof plannedSurrenderNote !== "string") {
      return c.json({ error: "Invalid plannedSurrenderNote" }, 400);
    }
    if (plannedSurrenderNote.length > 500) {
      return c.json({ error: "Note too long" }, 400);
    }
    normalizedNote = plannedSurrenderNote;
  }

  const updated = await repos.policies.update(policyId, {
    plannedSurrenderAt: plannedSurrenderAt as string | null,
    plannedSurrenderNote: normalizedNote,
  });
  if (!updated) return c.json({ error: "Policy not found" }, 404);
  return c.json({
    id: updated.id,
    plannedSurrenderAt: updated.plannedSurrenderAt ?? null,
    plannedSurrenderNote: updated.plannedSurrenderNote ?? null,
  });
});

// -- Delete policy (cascade) --
app.delete("/api/policies/:id", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid id" }, 400);

  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);

  const policyAttachments = await repos.attachments.findByPolicyId(policyId);

  await repos.attachments.deleteByPolicyId(policyId);
  await repos.beneficiaries.deleteByPolicyId(policyId);
  await repos.payments.deleteByPolicyId(policyId);
  await repos.cashValues.deleteByPolicyId(policyId);
  await repos.coverageItems.deleteByPolicyId(policyId);
  await repos.policies.delete(policyId);

  if (policyAttachments.length > 0) {
    const r2 = c.env.ATTACHMENTS;
    await Promise.allSettled(policyAttachments.map((a: { r2Key: string }) => r2.delete(a.r2Key)));
  }

  return c.json({ success: true });
});

// -- Beneficiaries --
app.get("/api/policies/:id/beneficiaries", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);

  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);

  const records = await repos.beneficiaries.findByPolicyId(policyId);
  const members = await repos.members.findAll();
  const memberMap = new Map(members.map((m: { id: number; name: string }) => [m.id, m.name]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json(records.map((b: any) => ({
    id: b.id, policyId: b.policyId, memberId: b.memberId,
    name: b.memberId ? memberMap.get(b.memberId) ?? b.externalName ?? "未知" : b.externalName ?? "未知",
    externalIdCard: b.externalIdCard, sharePercent: b.sharePercent, rankOrder: b.rankOrder,
  })));
});

// -- Payments --
app.get("/api/policies/:id/payments", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);
  const payments = await repos.payments.findByPolicyId(policyId);
  return c.json(payments.sort((a: { periodNumber: number }, b: { periodNumber: number }) => b.periodNumber - a.periodNumber));
});

app.post("/api/policies/:id/payments", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);

  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);

  if (isTerminalStatus(policy.status)) {
    return c.json({ error: "Cannot add payments to a terminated policy" }, 400);
  }

  const body = await c.req.json();
  if (!body.dueDate || body.amount == null || body.periodNumber == null) {
    return c.json({ error: "dueDate, amount, and periodNumber are required" }, 400);
  }

  const existing = await repos.payments.findByPolicyId(policyId);
  if (existing.some((p: { periodNumber: number }) => p.periodNumber === body.periodNumber)) {
    return c.json({ error: `Period ${body.periodNumber} already exists for this policy` }, 409);
  }

  const created = await repos.payments.create({
    policyId, periodNumber: body.periodNumber, dueDate: body.dueDate,
    amount: body.amount, status: body.status ?? "Pending",
    paidDate: body.paidDate ?? null, paidAmount: body.paidAmount ?? null,
  });
  return c.json(created, 201);
});

app.put("/api/policies/:id/payments/:paymentId", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const paymentIdNum = parseInt(c.req.param("paymentId"), 10);
  if (isNaN(policyId) || isNaN(paymentIdNum)) return c.json({ error: "Invalid ID" }, 400);

  const existing = await repos.payments.findById(paymentIdNum);
  if (!existing || existing.policyId !== policyId) return c.json({ error: "Payment not found" }, 404);

  const body = await c.req.json();

  const policy = await repos.policies.findById(policyId);
  if (policy && isTerminalStatus(policy.status)) {
    // Terminated policies allow only Paid back-fills:
    //   { status: "Paid", paidDate?, paidAmount? } — any structural field
    //   (dueDate, amount, periodNumber) is rejected.
    if (body.status !== "Paid") {
      return c.json({ error: "Only Paid updates are allowed for terminated policies" }, 400);
    }
    if (body.dueDate !== undefined || body.amount !== undefined || body.periodNumber !== undefined) {
      return c.json({ error: "Cannot modify payment structure in a terminated policy" }, 400);
    }
  }

  if (body.periodNumber !== undefined && body.periodNumber !== existing.periodNumber) {
    const policyPayments = await repos.payments.findByPolicyId(policyId);
    const duplicate = policyPayments.find((p: { periodNumber: number; id: number }) => p.periodNumber === body.periodNumber && p.id !== paymentIdNum);
    if (duplicate) return c.json({ error: `该保单已存在第 ${body.periodNumber} 期缴费记录` }, 409);
  }

  const updated = await repos.payments.update(paymentIdNum, {
    periodNumber: body.periodNumber ?? existing.periodNumber,
    dueDate: body.dueDate ?? existing.dueDate,
    amount: body.amount ?? existing.amount,
    status: body.status ?? existing.status,
    paidDate: body.paidDate !== undefined ? body.paidDate : existing.paidDate,
    paidAmount: body.paidAmount !== undefined ? body.paidAmount : existing.paidAmount,
  });
  if (!updated) return c.json({ error: "Payment not found" }, 404);
  return c.json(updated);
});

app.delete("/api/policies/:id/payments/:paymentId", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const paymentIdNum = parseInt(c.req.param("paymentId"), 10);
  if (isNaN(policyId) || isNaN(paymentIdNum)) return c.json({ error: "Invalid ID" }, 400);

  const existing = await repos.payments.findById(paymentIdNum);
  if (!existing || existing.policyId !== policyId) return c.json({ error: "Payment not found" }, 404);

  const policy = await repos.policies.findById(policyId);
  if (policy && isTerminalStatus(policy.status)) {
    return c.json({ error: "Cannot delete payments of a terminated policy" }, 400);
  }

  const deleted = await repos.payments.delete(paymentIdNum);
  if (!deleted) return c.json({ error: "Payment not found" }, 404);
  return c.json({ success: true });
});

app.post("/api/policies/:id/payments/generate", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);

  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);
  if (isTerminalStatus(policy.status)) {
    return c.json({ error: "Cannot generate payments for a terminated policy" }, 400);
  }
  if (!policy.effectiveDate) return c.json({ error: "Policy has no effective date" }, 400);

  const existingPayments = await repos.payments.findByPolicyId(policyId);
  const existingPeriodNumbers = new Set(existingPayments.map((p: { periodNumber: number }) => p.periodNumber));

  // Cutoff at end of the current calendar year in the product timezone
  // (CST). Users want this year's full schedule visible — including
  // upcoming periods — so they can plan ahead, not just see what's already
  // past due.
  const cutoffDate = parseLocalDate(endOfYearInTimeZone());

  // First due date anchors the schedule. Prefer policy.nextDueDate (the
  // first contractually scheduled premium date — absorbs waiting periods,
  // hesitation windows, and bank cycle alignment) and fall back to
  // effectiveDate for older records that pre-date nextDueDate capture.
  const firstDueDate = policy.nextDueDate ?? policy.effectiveDate;

  const newRecords = generatePaymentRecords(
    { policyId, firstDueDate, paymentFrequency: policy.paymentFrequency, totalPayments: policy.totalPayments, premium: policy.premium },
    { cutoffDate, existingPeriodNumbers },
  );
  // createMany uses onConflictDoNothing on (policyId, periodNumber), so
  // generated counts the rows actually inserted — accurate when a
  // concurrent request raced us and inserted some of the same periods.
  const inserted = newRecords.length > 0 ? await repos.payments.createMany(newRecords) : [];

  const allPayments = await repos.payments.findByPolicyId(policyId);
  return c.json({ generated: inserted.length, payments: allPayments.sort((a: { periodNumber: number }, b: { periodNumber: number }) => b.periodNumber - a.periodNumber) });
});

// -- Coverage items --
app.get("/api/policies/:id/coverage-items", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);
  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);
  return c.json(await repos.coverageItems.findByPolicyId(policyId));
});

app.post("/api/policies/:id/coverage-items", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);
  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  const item = await repos.coverageItems.create({
    policyId, name: body.name, periodLimit: body.periodLimit ?? null,
    lifetimeLimit: body.lifetimeLimit ?? null, deductible: body.deductible ?? null,
    coveragePercent: body.coveragePercent ?? null, isOptional: body.isOptional ?? false,
    notes: body.notes ?? null, sortOrder: body.sortOrder ?? 0,
  });
  return c.json(item, 201);
});

app.get("/api/policies/:id/coverage-items/:itemId", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const itemId = parseInt(c.req.param("itemId"), 10);
  if (isNaN(policyId) || isNaN(itemId)) return c.json({ error: "Invalid ID" }, 400);
  const item = await repos.coverageItems.findById(itemId);
  if (!item || item.policyId !== policyId) return c.json({ error: "Coverage item not found" }, 404);
  return c.json(item);
});

app.put("/api/policies/:id/coverage-items/:itemId", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const itemId = parseInt(c.req.param("itemId"), 10);
  if (isNaN(policyId) || isNaN(itemId)) return c.json({ error: "Invalid ID" }, 400);
  const existing = await repos.coverageItems.findById(itemId);
  if (!existing || existing.policyId !== policyId) return c.json({ error: "Coverage item not found" }, 404);
  const body = await c.req.json();
  const updated = await repos.coverageItems.update(itemId, {
    name: body.name, periodLimit: body.periodLimit, lifetimeLimit: body.lifetimeLimit,
    deductible: body.deductible, coveragePercent: body.coveragePercent,
    isOptional: body.isOptional, notes: body.notes, sortOrder: body.sortOrder,
  });
  if (!updated) return c.json({ error: "Coverage item not found" }, 404);
  return c.json(updated);
});

app.delete("/api/policies/:id/coverage-items/:itemId", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const itemId = parseInt(c.req.param("itemId"), 10);
  if (isNaN(policyId) || isNaN(itemId)) return c.json({ error: "Invalid ID" }, 400);
  const existing = await repos.coverageItems.findById(itemId);
  if (!existing || existing.policyId !== policyId) return c.json({ error: "Coverage item not found" }, 404);
  const deleted = await repos.coverageItems.delete(itemId);
  if (!deleted) return c.json({ error: "Coverage item not found" }, 404);
  return c.json({ success: true });
});

// -- Attachments --
app.get("/api/policies/:id/attachments", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);
  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);
  return c.json(await repos.attachments.findByPolicyId(policyId));
});

app.post("/api/policies/:id/attachments", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  if (isNaN(policyId)) return c.json({ error: "Invalid policy ID" }, 400);

  const policy = await repos.policies.findById(policyId);
  if (!policy) return c.json({ error: "Policy not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) return c.json({ error: "No file provided" }, 400);

  const validation = validateFile(file.type, file.size);
  if (!validation.valid) return c.json({ error: validation.error }, 400);

  const magicCheck = await validateMagicBytes(file);
  if (!magicCheck.valid) return c.json({ error: magicCheck.error }, 400);

  const count = await repos.attachments.countByPolicyId(policyId);
  if (count >= MAX_ATTACHMENTS_PER_POLICY) {
    return c.json({ error: `Maximum ${MAX_ATTACHMENTS_PER_POLICY} attachments per policy` }, 400);
  }

  const r2Key = generateR2Key(policyId, file.name);
  const r2 = c.env.ATTACHMENTS;
  await r2.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });

  let attachment;
  try {
    attachment = await repos.attachments.create({
      policyId, filename: file.name, r2Key, contentType: file.type, size: file.size,
    });
  } catch (dbError) {
    await r2.delete(r2Key).catch(() => {});
    throw dbError;
  }
  return c.json(attachment, 201);
});

app.get("/api/policies/:id/attachments/:attachmentId", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const attId = parseInt(c.req.param("attachmentId"), 10);
  if (isNaN(policyId) || isNaN(attId)) return c.json({ error: "Invalid ID" }, 400);
  const attachment = await repos.attachments.findByIdAndPolicyId(attId, policyId);
  if (!attachment) return c.json({ error: "Attachment not found" }, 404);
  return c.json(attachment);
});

app.delete("/api/policies/:id/attachments/:attachmentId", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const attId = parseInt(c.req.param("attachmentId"), 10);
  if (isNaN(policyId) || isNaN(attId)) return c.json({ error: "Invalid ID" }, 400);

  const attachment = await repos.attachments.findByIdAndPolicyId(attId, policyId);
  if (!attachment) return c.json({ error: "Attachment not found" }, 404);

  await repos.attachments.delete(attachment.id);
  await c.env.ATTACHMENTS.delete(attachment.r2Key).catch(() => {});
  return c.body(null, 204);
});

app.get("/api/policies/:id/attachments/:attachmentId/file", async (c) => {
  const repos = c.get("repos");
  const policyId = parseInt(c.req.param("id"), 10);
  const attId = parseInt(c.req.param("attachmentId"), 10);
  if (isNaN(policyId) || isNaN(attId)) return c.json({ error: "Invalid ID" }, 400);

  const attachment = await repos.attachments.findByIdAndPolicyId(attId, policyId);
  if (!attachment) return c.json({ error: "Attachment not found" }, 404);

  const obj = await c.env.ATTACHMENTS.get(attachment.r2Key);
  if (!obj) return c.json({ error: "File not found in storage" }, 404);

  const download = c.req.query("download") === "true";
  const disposition = download ? "attachment" : "inline";
  const asciiName = attachment.filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const utf8Name = encodeURIComponent(attachment.filename).replace(/['()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);

  return new Response(obj.body, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": attachment.size.toString(),
      "Cache-Control": "no-store",
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
    },
  });
});

export default app;
