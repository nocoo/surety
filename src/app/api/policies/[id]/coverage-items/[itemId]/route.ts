import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { coverageItemsRepo } = await import("@/db/repositories");
  const { id, itemId } = await context.params;
  const policyId = parseInt(id, 10);
  const coverageItemId = parseInt(itemId, 10);

  if (isNaN(policyId) || isNaN(coverageItemId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const item = coverageItemsRepo.findById(coverageItemId);

  if (!item || item.policyId !== policyId) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { coverageItemsRepo } = await import("@/db/repositories");
  const { id, itemId } = await context.params;
  const policyId = parseInt(id, 10);
  const coverageItemId = parseInt(itemId, 10);

  if (isNaN(policyId) || isNaN(coverageItemId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Verify item belongs to policy
  const existing = coverageItemsRepo.findById(coverageItemId);
  if (!existing || existing.policyId !== policyId) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  const body = await request.json();

  const updated = coverageItemsRepo.update(coverageItemId, {
    name: body.name,
    periodLimit: body.periodLimit,
    lifetimeLimit: body.lifetimeLimit,
    deductible: body.deductible,
    coveragePercent: body.coveragePercent,
    isOptional: body.isOptional,
    notes: body.notes,
    sortOrder: body.sortOrder,
  });

  if (!updated) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { coverageItemsRepo } = await import("@/db/repositories");
  const { id, itemId } = await context.params;
  const policyId = parseInt(id, 10);
  const coverageItemId = parseInt(itemId, 10);

  if (isNaN(policyId) || isNaN(coverageItemId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Verify item belongs to policy
  const existing = coverageItemsRepo.findById(coverageItemId);
  if (!existing || existing.policyId !== policyId) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  const deleted = coverageItemsRepo.delete(coverageItemId);

  if (!deleted) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
