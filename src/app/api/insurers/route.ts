import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbFromRequest();
  const { insurersRepo, policiesRepo } = await import("@/db/repositories");
  const insurers = insurersRepo.findAll();
  const policies = policiesRepo.findAll();

  // Count policies per insurer by name
  const policyCountMap = new Map<string, number>();
  for (const policy of policies) {
    const count = policyCountMap.get(policy.insurerName) ?? 0;
    policyCountMap.set(policy.insurerName, count + 1);
  }

  return NextResponse.json(insurers.map((i) => ({
    id: i.id,
    name: i.name,
    phone: i.phone,
    website: i.website,
    policyCount: policyCountMap.get(i.name) ?? 0,
  })));
}

export async function POST(request: NextRequest) {
  await ensureDbFromRequest();
  const { insurersRepo } = await import("@/db/repositories");

  const body = await request.json();

  if (!body.name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  // Check for duplicate name
  const existing = insurersRepo.findByName(body.name);
  if (existing) {
    return NextResponse.json(
      { error: "Insurer with this name already exists" },
      { status: 409 }
    );
  }

  const insurer = insurersRepo.create({
    name: body.name,
    phone: body.phone || null,
    website: body.website || null,
  });

  return NextResponse.json(
    {
      id: insurer.id,
      name: insurer.name,
      phone: insurer.phone,
      website: insurer.website,
    },
    { status: 201 }
  );
}
