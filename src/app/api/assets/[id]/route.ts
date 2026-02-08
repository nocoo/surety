import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { assetsRepo, membersRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const assetId = parseInt(id, 10);

  if (isNaN(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const asset = assetsRepo.findById(assetId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const members = membersRepo.findAll();
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  return NextResponse.json({
    id: asset.id,
    type: asset.type,
    name: asset.name,
    identifier: asset.identifier,
    ownerId: asset.ownerId,
    ownerName: asset.ownerId ? memberMap.get(asset.ownerId) ?? "未知" : null,
    details: asset.details,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { assetsRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const assetId = parseInt(id, 10);

  if (isNaN(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  const updated = assetsRepo.update(assetId, {
    type: body.type,
    name: body.name,
    identifier: body.identifier,
    ownerId: body.ownerId,
    details: body.details,
  });

  if (!updated) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    type: updated.type,
    name: updated.name,
    identifier: updated.identifier,
    ownerId: updated.ownerId,
    details: updated.details,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { assetsRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const assetId = parseInt(id, 10);

  if (isNaN(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = assetsRepo.delete(assetId);

  if (!deleted) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
