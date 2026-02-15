import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { coverageItemsRepo, policiesRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  const policy = policiesRepo.findById(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const items = coverageItemsRepo.findByPolicyId(policyId);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { coverageItemsRepo, policiesRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  const policy = policiesRepo.findById(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const body = await request.json();

  if (!body.name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const item = coverageItemsRepo.create({
    policyId,
    name: body.name,
    periodLimit: body.periodLimit ?? null,
    lifetimeLimit: body.lifetimeLimit ?? null,
    deductible: body.deductible ?? null,
    coveragePercent: body.coveragePercent ?? null,
    isOptional: body.isOptional ?? false,
    notes: body.notes ?? null,
    sortOrder: body.sortOrder ?? 0,
  });

  return NextResponse.json(item, { status: 201 });
}
