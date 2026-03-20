import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { repos } = await getReposFromRequest();
  const { id } = await params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  const payments = await repos.payments.findByPolicyId(policyId);

  // Sort by period number descending (most recent first)
  const sortedPayments = payments.sort((a, b) => b.periodNumber - a.periodNumber);

  return NextResponse.json(sortedPayments);
}
