import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbFromRequest();
  const { paymentsRepo } = await import("@/db/repositories");
  const { id } = await params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  const payments = paymentsRepo.findByPolicyId(policyId);

  // Sort by period number descending (most recent first)
  const sortedPayments = payments.sort((a, b) => b.periodNumber - a.periodNumber);

  return NextResponse.json(sortedPayments);
}
