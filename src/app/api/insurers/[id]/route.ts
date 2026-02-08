import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { insurersRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const insurerId = parseInt(id, 10);

  if (isNaN(insurerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const insurer = insurersRepo.findById(insurerId);

  if (!insurer) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: insurer.id,
    name: insurer.name,
    phone: insurer.phone,
    website: insurer.website,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { insurersRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const insurerId = parseInt(id, 10);

  if (isNaN(insurerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  // Check for duplicate name if name is being updated
  if (body.name) {
    const existing = insurersRepo.findByName(body.name);
    if (existing && existing.id !== insurerId) {
      return NextResponse.json(
        { error: "Insurer with this name already exists" },
        { status: 409 }
      );
    }
  }

  const updated = insurersRepo.update(insurerId, {
    name: body.name,
    phone: body.phone,
    website: body.website,
  });

  if (!updated) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    website: updated.website,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { insurersRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const insurerId = parseInt(id, 10);

  if (isNaN(insurerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = insurersRepo.delete(insurerId);

  if (!deleted) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
