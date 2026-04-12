import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const ALLOWED_VISIT_TYPES = ["儿保", "门诊", "急诊", "体检", "复查", "预约"];

export async function GET(request: NextRequest) {
  const { repos } = await getReposFromRequest();
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  let visits;
  if (memberId) {
    visits = await repos.medicalVisits.findByMemberId(parseInt(memberId, 10));
  } else {
    visits = await repos.medicalVisits.findAll();
  }

  // Get lookup data
  const members = await repos.members.findAll();
  const hospitals = await repos.hospitals.findAll();
  const doctors = await repos.doctors.findAll();

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h.name]));
  const doctorMap = new Map(doctors.map((d) => [d.id, d.name]));

  return NextResponse.json(
    visits.map((v) => {
      const member = memberMap.get(v.memberId);
      return {
        id: v.id,
        memberId: v.memberId,
        memberName: member?.name ?? null,
        memberBirthDate: member?.birthDate ?? null,
        hospitalId: v.hospitalId,
        hospitalName: hospitalMap.get(v.hospitalId) ?? null,
        doctorId: v.doctorId,
        doctorName: v.doctorId ? doctorMap.get(v.doctorId) ?? null : null,
        visitDate: v.visitDate,
        visitTimeStart: v.visitTimeStart,
        visitTimeEnd: v.visitTimeEnd,
        visitType: v.visitType,
        visitReason: v.visitReason,
        department: v.department,
        symptoms: v.symptoms,
        diagnosis: v.diagnosis,
        assessment: v.assessment,
        treatment: v.treatment,
        totalCost: v.totalCost,
        insurancePaid: v.insurancePaid,
        selfPaid: v.selfPaid,
        notes: v.notes,
      };
    })
  );
}

export async function POST(request: NextRequest) {
  const { repos } = await getReposFromRequest();
  const body = await request.json();

  // Validate required fields
  if (!body.memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 }
    );
  }
  if (!body.hospitalId) {
    return NextResponse.json(
      { error: "hospitalId is required" },
      { status: 400 }
    );
  }
  if (!body.visitDate) {
    return NextResponse.json(
      { error: "visitDate is required" },
      { status: 400 }
    );
  }
  if (!body.visitType) {
    return NextResponse.json(
      { error: "visitType is required" },
      { status: 400 }
    );
  }
  if (!body.visitReason) {
    return NextResponse.json(
      { error: "visitReason is required" },
      { status: 400 }
    );
  }

  // Validate visit type
  if (!ALLOWED_VISIT_TYPES.includes(body.visitType)) {
    return NextResponse.json(
      { error: `不支持的就诊类型: ${body.visitType}` },
      { status: 400 }
    );
  }

  // Verify member exists
  const member = await repos.members.findById(body.memberId);
  if (!member) {
    return NextResponse.json({ error: "成员不存在" }, { status: 400 });
  }

  // Verify hospital exists
  const hospital = await repos.hospitals.findById(body.hospitalId);
  if (!hospital) {
    return NextResponse.json({ error: "医院不存在" }, { status: 400 });
  }

  // Verify doctor exists and belongs to hospital
  let doctorName = null;
  if (body.doctorId) {
    const doctor = await repos.doctors.findById(body.doctorId);
    if (!doctor) {
      return NextResponse.json({ error: "医生不存在" }, { status: 400 });
    }
    if (doctor.hospitalId !== body.hospitalId) {
      return NextResponse.json(
        { error: "所选医生不属于该医院" },
        { status: 400 }
      );
    }
    doctorName = doctor.name;
  }

  // Validate cost consistency (only when all three provided)
  if (
    body.totalCost != null &&
    body.insurancePaid != null &&
    body.selfPaid != null
  ) {
    const expected = body.insurancePaid + body.selfPaid;
    if (Math.abs(body.totalCost - expected) > 0.01) {
      return NextResponse.json(
        { error: "费用不一致：总费用 ≠ 医保支付 + 自付金额" },
        { status: 400 }
      );
    }
  }

  const visit = await repos.medicalVisits.create({
    memberId: body.memberId,
    hospitalId: body.hospitalId,
    doctorId: body.doctorId || null,
    visitDate: body.visitDate,
    visitTimeStart: body.visitTimeStart || null,
    visitTimeEnd: body.visitTimeEnd || null,
    visitType: body.visitType,
    visitReason: body.visitReason,
    department: body.department || null,
    symptoms: body.symptoms || null,
    diagnosis: body.diagnosis || null,
    assessment: body.assessment || null,
    treatment: body.treatment || null,
    totalCost: body.totalCost ?? null,
    insurancePaid: body.insurancePaid ?? null,
    selfPaid: body.selfPaid ?? null,
    notes: body.notes || null,
  });

  return NextResponse.json(
    {
      id: visit.id,
      memberId: visit.memberId,
      memberName: member.name,
      memberBirthDate: member.birthDate,
      hospitalId: visit.hospitalId,
      hospitalName: hospital.name,
      doctorId: visit.doctorId,
      doctorName,
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
    },
    { status: 201 }
  );
}
