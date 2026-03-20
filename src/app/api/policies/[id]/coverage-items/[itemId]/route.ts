import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id, itemId } = await context.params;
  const policyId = parseInt(id, 10);
  const coverageItemId = parseInt(itemId, 10);

  if (isNaN(policyId) || isNaN(coverageItemId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const item = await repos.coverageItems.findById(coverageItemId);

  if (!item || item.policyId !== policyId) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id, itemId } = await context.params;
  const policyId = parseInt(id, 10);
  const coverageItemId = parseInt(itemId, 10);

  if (isNaN(policyId) || isNaN(coverageItemId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Verify item belongs to policy
  const existing = await repos.coverageItems.findById(coverageItemId);
  if (!existing || existing.policyId !== policyId) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  const body = await request.json();

  const updated = await repos.coverageItems.update(coverageItemId, {
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
  const { repos } = await getReposFromRequest();
  const { id, itemId } = await context.params;
  const policyId = parseInt(id, 10);
  const coverageItemId = parseInt(itemId, 10);

  if (isNaN(policyId) || isNaN(coverageItemId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Verify item belongs to policy
  const existing = await repos.coverageItems.findById(coverageItemId);
  if (!existing || existing.policyId !== policyId) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  const deleted = await repos.coverageItems.delete(coverageItemId);

  if (!deleted) {
    return NextResponse.json({ error: "Coverage item not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
