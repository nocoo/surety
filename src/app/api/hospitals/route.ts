import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const { repos } = await getReposFromRequest();
  const hospitals = await repos.hospitals.findAll();
  const doctors = await repos.doctors.findAll();

  // Count doctors per hospital
  const doctorCountMap = new Map<number, number>();
  for (const doctor of doctors) {
    const count = doctorCountMap.get(doctor.hospitalId) ?? 0;
    doctorCountMap.set(doctor.hospitalId, count + 1);
  }

  return NextResponse.json(
    hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      level: h.level,
      isPublic: h.isPublic,
      address: h.address,
      phone: h.phone,
      notes: h.notes,
      doctorCount: doctorCountMap.get(h.id) ?? 0,
    }))
  );
}

export async function POST(request: NextRequest) {
  const { repos } = await getReposFromRequest();
  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const hospital = await repos.hospitals.create({
    name: body.name,
    level: body.level || null,
    isPublic: body.isPublic ?? true,
    address: body.address || null,
    phone: body.phone || null,
    notes: body.notes || null,
  });

  return NextResponse.json(
    {
      id: hospital.id,
      name: hospital.name,
      level: hospital.level,
      isPublic: hospital.isPublic,
      address: hospital.address,
      phone: hospital.phone,
      notes: hospital.notes,
    },
    { status: 201 }
  );
}
