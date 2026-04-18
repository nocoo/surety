import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const doctorId = parseInt(id, 10);

  if (isNaN(doctorId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doctor = await repos.doctors.findById(doctorId);

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const hospital = await repos.hospitals.findById(doctor.hospitalId);

  return NextResponse.json({
    id: doctor.id,
    name: doctor.name,
    hospitalId: doctor.hospitalId,
    hospitalName: hospital?.name ?? null,
    department: doctor.department,
    title: doctor.title,
    specialty: doctor.specialty,
    phone: doctor.phone,
    notes: doctor.notes,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const doctorId = parseInt(id, 10);

  if (isNaN(doctorId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await repos.doctors.findById(doctorId);
  if (!existing) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const body = await request.json();

  // Verify hospital exists if hospitalId is being updated
  if (body.hospitalId !== undefined && body.hospitalId !== existing.hospitalId) {
    const hospital = await repos.hospitals.findById(body.hospitalId);
    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 400 });
    }

    // Check if doctor is referenced by medical visits - cannot change hospital
    const visits = await repos.medicalVisits.findByDoctorId(doctorId);
    if (visits.length > 0) {
      return NextResponse.json(
        { error: `该医生有 ${visits.length} 条就诊记录，无法更改所属医院` },
        { status: 409 }
      );
    }
  }

  // Validate department is not empty/null (required field)
  if (body.department !== undefined && !body.department?.trim()) {
    return NextResponse.json({ error: "科室不能为空" }, { status: 400 });
  }

  const updated = await repos.doctors.update(doctorId, {
    name: body.name,
    hospitalId: body.hospitalId,
    department: body.department,
    title: body.title,
    specialty: body.specialty,
    phone: body.phone,
    notes: body.notes,
  });

  if (!updated) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const hospital = await repos.hospitals.findById(updated.hospitalId);

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    hospitalId: updated.hospitalId,
    hospitalName: hospital?.name ?? null,
    department: updated.department,
    title: updated.title,
    specialty: updated.specialty,
    phone: updated.phone,
    notes: updated.notes,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const doctorId = parseInt(id, 10);

  if (isNaN(doctorId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Check FK references: medical visits may reference this doctor
  const visits = await repos.medicalVisits.findByDoctorId(doctorId);
  if (visits.length > 0) {
    return NextResponse.json(
      { error: `该医生有 ${visits.length} 条就诊记录，无法删除` },
      { status: 409 }
    );
  }

  const deleted = await repos.doctors.delete(doctorId);

  if (!deleted) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
