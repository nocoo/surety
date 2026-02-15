import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { membersRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const memberId = parseInt(id, 10);

  if (isNaN(memberId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const member = membersRepo.findById(memberId);

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: member.id,
    name: member.name,
    relation: member.relation,
    gender: member.gender,
    birthDate: member.birthDate,
    idCard: member.idCard,
    idType: member.idType,
    idExpiry: member.idExpiry,
    phone: member.phone,
    hasSocialInsurance: member.hasSocialInsurance,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { membersRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const memberId = parseInt(id, 10);

  if (isNaN(memberId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  const updated = membersRepo.update(memberId, {
    name: body.name,
    relation: body.relation,
    gender: body.gender,
    birthDate: body.birthDate,
    idCard: body.idCard,
    idType: body.idType,
    idExpiry: body.idExpiry,
    phone: body.phone,
    hasSocialInsurance: body.hasSocialInsurance,
  });

  if (!updated) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    relation: updated.relation,
    gender: updated.gender,
    birthDate: updated.birthDate,
    idCard: updated.idCard,
    idType: updated.idType,
    idExpiry: updated.idExpiry,
    phone: updated.phone,
    hasSocialInsurance: updated.hasSocialInsurance,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  await ensureDbFromRequest();
  const { membersRepo } = await import("@/db/repositories");
  const { id } = await context.params;
  const memberId = parseInt(id, 10);

  if (isNaN(memberId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = membersRepo.delete(memberId);

  if (!deleted) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
