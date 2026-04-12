import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { repos } = await getReposFromRequest();
  const { searchParams } = new URL(request.url);
  const hospitalId = searchParams.get("hospitalId");

  let doctors;
  if (hospitalId) {
    doctors = await repos.doctors.findByHospitalId(parseInt(hospitalId, 10));
  } else {
    doctors = await repos.doctors.findAll();
  }

  // Get hospitals for name lookup
  const hospitals = await repos.hospitals.findAll();
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h.name]));

  // Get visit counts for each doctor
  const allVisits = await repos.medicalVisits.findAll();
  const visitCountMap = new Map<number, number>();
  for (const visit of allVisits) {
    if (visit.doctorId) {
      visitCountMap.set(visit.doctorId, (visitCountMap.get(visit.doctorId) ?? 0) + 1);
    }
  }

  return NextResponse.json(
    doctors.map((d) => ({
      id: d.id,
      name: d.name,
      hospitalId: d.hospitalId,
      hospitalName: hospitalMap.get(d.hospitalId) ?? null,
      department: d.department,
      title: d.title,
      specialty: d.specialty,
      phone: d.phone,
      notes: d.notes,
      visitCount: visitCountMap.get(d.id) ?? 0,
    }))
  );
}

export async function POST(request: NextRequest) {
  const { repos } = await getReposFromRequest();
  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.hospitalId) {
    return NextResponse.json(
      { error: "hospitalId is required" },
      { status: 400 }
    );
  }
  if (!body.department) {
    return NextResponse.json(
      { error: "department is required" },
      { status: 400 }
    );
  }

  // Verify hospital exists
  const hospital = await repos.hospitals.findById(body.hospitalId);
  if (!hospital) {
    return NextResponse.json({ error: "医院不存在" }, { status: 400 });
  }

  const doctor = await repos.doctors.create({
    name: body.name,
    hospitalId: body.hospitalId,
    department: body.department,
    title: body.title || null,
    specialty: body.specialty || null,
    phone: body.phone || null,
    notes: body.notes || null,
  });

  return NextResponse.json(
    {
      id: doctor.id,
      name: doctor.name,
      hospitalId: doctor.hospitalId,
      hospitalName: hospital.name,
      department: doctor.department,
      title: doctor.title,
      specialty: doctor.specialty,
      phone: doctor.phone,
      notes: doctor.notes,
    },
    { status: 201 }
  );
}
