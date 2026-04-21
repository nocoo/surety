import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const assetId = parseInt(id, 10);

  if (isNaN(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const asset = await repos.assets.findById(assetId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const members = await repos.members.findAll();
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
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const assetId = parseInt(id, 10);

  if (isNaN(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  const updated = await repos.assets.update(assetId, {
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
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const assetId = parseInt(id, 10);

  if (isNaN(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Check if asset has linked policies
  const policies = await repos.policies.findAll();
  const linkedPolicies = policies.filter(
    (p) => p.insuredType === "Asset" && p.insuredAssetId === assetId
  );

  if (linkedPolicies.length > 0) {
    return NextResponse.json(
      { error: `该资产关联了 ${linkedPolicies.length} 份保单，无法删除` },
      { status: 409 }
    );
  }

  const deleted = await repos.assets.delete(assetId);

  if (!deleted) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
