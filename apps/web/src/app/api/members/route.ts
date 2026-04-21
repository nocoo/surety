import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const members = await repos.members.findAll();

  const result = await Promise.all(
    members.map(async (m) => ({
      id: m.id,
      name: m.name,
      relation: m.relation,
      gender: m.gender,
      birthDate: m.birthDate,
      idCard: m.idCard,
      idType: m.idType,
      idExpiry: m.idExpiry,
      phone: m.phone,
      hasSocialInsurance: m.hasSocialInsurance,
      policyCount: (await repos.policies.findByInsuredMemberId(m.id)).length,
    }))
  );

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();

  const body = await request.json();

  if (!body.name || !body.relation) {
    return NextResponse.json(
      { error: "name and relation are required" },
      { status: 400 }
    );
  }

  const member = await repos.members.create({
    name: body.name,
    relation: body.relation,
    gender: body.gender || null,
    birthDate: body.birthDate || null,
    idCard: body.idCard || null,
    idType: body.idType || null,
    idExpiry: body.idExpiry || null,
    phone: body.phone || null,
    hasSocialInsurance: body.hasSocialInsurance ?? null,
  });

  return NextResponse.json(
    {
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
    },
    { status: 201 }
  );
}
