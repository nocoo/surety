import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { membersRepo } = await import("@/db/repositories");
  const members = membersRepo.findAll();

  const result = members.map((m) => ({
    id: m.id,
    name: m.name,
    relation: m.relation,
    gender: m.gender,
    birthDate: m.birthDate,
    phone: m.phone,
  }));

  return NextResponse.json(result);
}
