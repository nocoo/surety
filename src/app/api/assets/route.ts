import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { assetsRepo, membersRepo, policiesRepo } = await import("@/db/repositories");
  const assets = assetsRepo.findAll();
  const members = membersRepo.findAll();
  const policies = policiesRepo.findAll();
  
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  
  // Count policies per asset (any policy with insuredAssetId)
  const policyCountMap = new Map<number, number>();
  for (const policy of policies) {
    if (policy.insuredAssetId) {
      const count = policyCountMap.get(policy.insuredAssetId) ?? 0;
      policyCountMap.set(policy.insuredAssetId, count + 1);
    }
  }

  const result = assets.map((a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    identifier: a.identifier,
    ownerId: a.ownerId,
    ownerName: a.ownerId ? memberMap.get(a.ownerId) ?? "未知" : null,
    details: a.details,
    policyCount: policyCountMap.get(a.id) ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { assetsRepo } = await import("@/db/repositories");

  const body = await request.json();

  if (!body.type || !body.name || !body.identifier) {
    return NextResponse.json(
      { error: "type, name, and identifier are required" },
      { status: 400 }
    );
  }

  if (body.type !== "RealEstate" && body.type !== "Vehicle") {
    return NextResponse.json(
      { error: "type must be RealEstate or Vehicle" },
      { status: 400 }
    );
  }

  const asset = assetsRepo.create({
    type: body.type,
    name: body.name,
    identifier: body.identifier,
    ownerId: body.ownerId ?? null,
    details: body.details ?? null,
  });

  return NextResponse.json(
    {
      id: asset.id,
      type: asset.type,
      name: asset.name,
      identifier: asset.identifier,
      ownerId: asset.ownerId,
      details: asset.details,
    },
    { status: 201 }
  );
}
