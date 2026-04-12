import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_VISIT_TYPES = ["儿保", "门诊", "急诊", "体检", "复查", "预约"];

export async function GET(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const visit = await repos.medicalVisits.findById(visitId);

  if (!visit) {
    return NextResponse.json(
      { error: "Medical visit not found" },
      { status: 404 }
    );
  }

  const member = await repos.members.findById(visit.memberId);
  const hospital = await repos.hospitals.findById(visit.hospitalId);
  const doctor = visit.doctorId
    ? await repos.doctors.findById(visit.doctorId)
    : null;

  return NextResponse.json({
    id: visit.id,
    memberId: visit.memberId,
    memberName: member?.name ?? null,
    memberBirthDate: member?.birthDate ?? null,
    hospitalId: visit.hospitalId,
    hospitalName: hospital?.name ?? null,
    doctorId: visit.doctorId,
    doctorName: doctor?.name ?? null,
    visitDate: visit.visitDate,
    visitTimeStart: visit.visitTimeStart,
    visitTimeEnd: visit.visitTimeEnd,
    visitType: visit.visitType,
    visitReason: visit.visitReason,
    department: visit.department,
    symptoms: visit.symptoms,
    diagnosis: visit.diagnosis,
    assessment: visit.assessment,
    treatment: visit.treatment,
    totalCost: visit.totalCost,
    insurancePaid: visit.insurancePaid,
    selfPaid: visit.selfPaid,
    notes: visit.notes,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await repos.medicalVisits.findById(visitId);
  if (!existing) {
    return NextResponse.json(
      { error: "Medical visit not found" },
      { status: 404 }
    );
  }

  const body = await request.json();

  // Validate visit type if provided
  if (body.visitType && !ALLOWED_VISIT_TYPES.includes(body.visitType)) {
    return NextResponse.json(
      { error: `不支持的就诊类型: ${body.visitType}` },
      { status: 400 }
    );
  }

  // Verify hospital exists if hospitalId is being updated
  const hospitalId = body.hospitalId ?? existing.hospitalId;
  if (body.hospitalId) {
    const hospital = await repos.hospitals.findById(body.hospitalId);
    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 400 });
    }
  }

  // Determine effective doctorId after update
  // If body.doctorId is explicitly null, clear doctor; if undefined, keep existing
  const effectiveDoctorId =
    body.doctorId === null
      ? null
      : body.doctorId !== undefined
        ? body.doctorId
        : existing.doctorId;

  // Verify doctor exists and belongs to the (possibly new) hospital
  if (effectiveDoctorId) {
    const doctor = await repos.doctors.findById(effectiveDoctorId);
    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 400 });
    }
    if (doctor.hospitalId !== hospitalId) {
      return NextResponse.json(
        { error: "所选医生不属于该医院" },
        { status: 400 }
      );
    }
  }

  // Validate cost consistency (only when all three provided)
  const totalCost = body.totalCost ?? existing.totalCost;
  const insurancePaid = body.insurancePaid ?? existing.insurancePaid;
  const selfPaid = body.selfPaid ?? existing.selfPaid;
  if (totalCost != null && insurancePaid != null && selfPaid != null) {
    const expected = insurancePaid + selfPaid;
    if (Math.abs(totalCost - expected) > 0.01) {
      return NextResponse.json(
        { error: "费用不一致：总费用 ≠ 医保支付 + 自付金额" },
        { status: 400 }
      );
    }
  }

  const updated = await repos.medicalVisits.update(visitId, {
    memberId: body.memberId,
    hospitalId: body.hospitalId,
    doctorId: body.doctorId,
    visitDate: body.visitDate,
    visitTimeStart: body.visitTimeStart,
    visitTimeEnd: body.visitTimeEnd,
    visitType: body.visitType,
    visitReason: body.visitReason,
    department: body.department,
    symptoms: body.symptoms,
    diagnosis: body.diagnosis,
    assessment: body.assessment,
    treatment: body.treatment,
    totalCost: body.totalCost,
    insurancePaid: body.insurancePaid,
    selfPaid: body.selfPaid,
    notes: body.notes,
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Medical visit not found" },
      { status: 404 }
    );
  }

  const member = await repos.members.findById(updated.memberId);
  const hospital = await repos.hospitals.findById(updated.hospitalId);
  const doctor = updated.doctorId
    ? await repos.doctors.findById(updated.doctorId)
    : null;

  return NextResponse.json({
    id: updated.id,
    memberId: updated.memberId,
    memberName: member?.name ?? null,
    memberBirthDate: member?.birthDate ?? null,
    hospitalId: updated.hospitalId,
    hospitalName: hospital?.name ?? null,
    doctorId: updated.doctorId,
    doctorName: doctor?.name ?? null,
    visitDate: updated.visitDate,
    visitTimeStart: updated.visitTimeStart,
    visitTimeEnd: updated.visitTimeEnd,
    visitType: updated.visitType,
    visitReason: updated.visitReason,
    department: updated.department,
    symptoms: updated.symptoms,
    diagnosis: updated.diagnosis,
    assessment: updated.assessment,
    treatment: updated.treatment,
    totalCost: updated.totalCost,
    insurancePaid: updated.insurancePaid,
    selfPaid: updated.selfPaid,
    notes: updated.notes,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = await repos.medicalVisits.delete(visitId);

  if (!deleted) {
    return NextResponse.json(
      { error: "Medical visit not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
