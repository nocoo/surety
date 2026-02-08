import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { insurersRepo } = await import("@/db/repositories");
  const insurers = insurersRepo.findAll();

  return NextResponse.json(insurers.map((i) => ({
    id: i.id,
    name: i.name,
    phone: i.phone,
    website: i.website,
  })));
}

export async function POST(request: NextRequest) {
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
