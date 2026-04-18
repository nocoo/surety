import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  const payments = await repos.payments.findByPolicyId(policyId);

  // Sort by period number descending (most recent first)
  const sortedPayments = payments.sort((a, b) => b.periodNumber - a.periodNumber);

  return NextResponse.json(sortedPayments);
}

/**
 * POST /api/policies/[id]/payments — Create a single payment record.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  // Verify policy exists
  const policy = await repos.policies.findById(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const body = await request.json();

  if (!body.dueDate || body.amount == null || body.periodNumber == null) {
    return NextResponse.json(
      { error: "dueDate, amount, and periodNumber are required" },
      { status: 400 },
    );
  }

  // Check for duplicate period number
  const existing = await repos.payments.findByPolicyId(policyId);
  if (existing.some((p) => p.periodNumber === body.periodNumber)) {
    return NextResponse.json(
      { error: `Period ${body.periodNumber} already exists for this policy` },
      { status: 409 },
    );
  }

  const created = await repos.payments.create({
    policyId,
    periodNumber: body.periodNumber,
    dueDate: body.dueDate,
    amount: body.amount,
    status: body.status ?? "Pending",
    paidDate: body.paidDate ?? null,
    paidAmount: body.paidAmount ?? null,
  });

  return NextResponse.json(created, { status: 201 });
}
