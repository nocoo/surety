import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const hospitalId = parseInt(id, 10);

  if (isNaN(hospitalId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const hospital = await repos.hospitals.findById(hospitalId);

  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: hospital.id,
    name: hospital.name,
    level: hospital.level,
    isPublic: hospital.isPublic,
    address: hospital.address,
    phone: hospital.phone,
    notes: hospital.notes,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const hospitalId = parseInt(id, 10);

  if (isNaN(hospitalId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  const updated = await repos.hospitals.update(hospitalId, {
    name: body.name,
    level: body.level,
    isPublic: body.isPublic,
    address: body.address,
    phone: body.phone,
    notes: body.notes,
  });

  if (!updated) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    level: updated.level,
    isPublic: updated.isPublic,
    address: updated.address,
    phone: updated.phone,
    notes: updated.notes,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const hospitalId = parseInt(id, 10);

  if (isNaN(hospitalId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Check FK references: doctors may reference this hospital
  const doctors = await repos.doctors.findByHospitalId(hospitalId);
  if (doctors.length > 0) {
    return NextResponse.json(
      { error: `该医院有 ${doctors.length} 位关联医生，无法删除` },
      { status: 409 }
    );
  }

  // Check FK references: medical visits may reference this hospital
  const visits = await repos.medicalVisits.findByHospitalId(hospitalId);
  if (visits.length > 0) {
    return NextResponse.json(
      { error: `该医院有 ${visits.length} 条就诊记录，无法删除` },
      { status: 409 }
    );
  }

  const deleted = await repos.hospitals.delete(hospitalId);

  if (!deleted) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
