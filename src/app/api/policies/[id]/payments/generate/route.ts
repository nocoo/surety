import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { generatePaymentRecords } from "@/lib/generate-payments";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/policies/[id]/payments/generate
 *
 * Auto-generate all payment records (past as Paid, future as Pending).
 * Idempotent: skips already-existing period numbers.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  // Load policy
  const policy = await repos.policies.findById(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  if (!policy.effectiveDate) {
    return NextResponse.json(
      { error: "Policy has no effective date" },
      { status: 400 },
    );
  }

  // Fetch existing payments for idempotency
  const existingPayments = await repos.payments.findByPolicyId(policyId);
  const existingPeriodNumbers = new Set(
    existingPayments.map((p) => p.periodNumber),
  );

  // Generate all payment records (past as Paid, future as Pending)
  const newRecords = generatePaymentRecords(
    {
      policyId,
      effectiveDate: policy.effectiveDate,
      paymentFrequency: policy.paymentFrequency,
      totalPayments: policy.totalPayments,
      premium: policy.premium,
    },
    null,
    existingPeriodNumbers,
  );

  if (newRecords.length > 0) {
    await repos.payments.createMany(newRecords);
  }

  // Return updated full list
  const allPayments = await repos.payments.findByPolicyId(policyId);
  const sorted = allPayments.sort(
    (a, b) => b.periodNumber - a.periodNumber,
  );

  return NextResponse.json({
    generated: newRecords.length,
    payments: sorted,
  });
}
