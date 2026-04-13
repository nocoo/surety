import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; paymentId: string }> };

/**
 * PUT /api/policies/[id]/payments/[paymentId] — Update a payment record.
 * Primary use case: mark as Paid with paidDate.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id, paymentId } = await context.params;
  const policyId = parseInt(id, 10);
  const paymentIdNum = parseInt(paymentId, 10);

  if (isNaN(policyId) || isNaN(paymentIdNum)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Verify payment belongs to policy
  const existing = await repos.payments.findById(paymentIdNum);
  if (!existing || existing.policyId !== policyId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const body = await request.json();

  // Check for periodNumber duplicate if being updated
  if (body.periodNumber !== undefined && body.periodNumber !== existing.periodNumber) {
    const policyPayments = await repos.payments.findByPolicyId(policyId);
    const duplicate = policyPayments.find(
      (p) => p.periodNumber === body.periodNumber && p.id !== paymentIdNum
    );
    if (duplicate) {
      return NextResponse.json(
        { error: `该保单已存在第 ${body.periodNumber} 期缴费记录` },
        { status: 409 }
      );
    }
  }

  const updated = await repos.payments.update(paymentIdNum, {
    periodNumber: body.periodNumber ?? existing.periodNumber,
    dueDate: body.dueDate ?? existing.dueDate,
    amount: body.amount ?? existing.amount,
    status: body.status ?? existing.status,
    paidDate: body.paidDate !== undefined ? body.paidDate : existing.paidDate,
    paidAmount: body.paidAmount !== undefined ? body.paidAmount : existing.paidAmount,
  });

  if (!updated) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/policies/[id]/payments/[paymentId] — Delete a payment record.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id, paymentId } = await context.params;
  const policyId = parseInt(id, 10);
  const paymentIdNum = parseInt(paymentId, 10);

  if (isNaN(policyId) || isNaN(paymentIdNum)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Verify payment belongs to policy
  const existing = await repos.payments.findById(paymentIdNum);
  if (!existing || existing.policyId !== policyId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const deleted = await repos.payments.delete(paymentIdNum);

  if (!deleted) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
