import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbFromRequest();
  const { membersRepo, policiesRepo } = await import("@/db/repositories");
  const members = membersRepo.findAll();

  const result = members.map((m) => ({
    id: m.id,
    name: m.name,
    relation: m.relation,
    gender: m.gender,
    birthDate: m.birthDate,
    phone: m.phone,
    policyCount: policiesRepo.findByInsuredMemberId(m.id).length,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  await ensureDbFromRequest();
  const { membersRepo } = await import("@/db/repositories");

  const body = await request.json();

  if (!body.name || !body.relation) {
    return NextResponse.json(
      { error: "name and relation are required" },
      { status: 400 }
    );
  }

  const member = membersRepo.create({
    name: body.name,
    relation: body.relation,
    gender: body.gender || null,
    birthDate: body.birthDate || null,
    idCard: body.idCard || null,
    phone: body.phone || null,
  });

  return NextResponse.json(
    {
      id: member.id,
      name: member.name,
      relation: member.relation,
      gender: member.gender,
      birthDate: member.birthDate,
      phone: member.phone,
    },
    { status: 201 }
  );
}
