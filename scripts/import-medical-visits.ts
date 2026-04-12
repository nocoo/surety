#!/usr/bin/env bun
/**
 * Import medical visit records from Notion CSV export
 * Usage: bun run scripts/import-medical-visits.ts <csv-path> <member-id>
 */

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

// CSV columns: 类型,距离,时间,就诊原因,医院,医生,检查项目,诊断,治疗方案

interface CsvRow {
  类型: string;
  距离: string;
  时间: string;
  就诊原因: string;
  医院: string;
  医生: string;
  检查项目: string;
  诊断: string;
  治疗方案: string;
}

interface ParsedVisit {
  visitType: string;
  visitDate: string;
  visitTimeStart: string | null;
  visitTimeEnd: string | null;
  visitReason: string;
  hospitalName: string;
  doctorName: string | null;
  symptoms: string[] | null;
  diagnosis: string | null;
  treatment: string | null;
}

function parseHospitalName(raw: string): string {
  const match = raw.match(/^([^(]+)/);
  return match?.[1]?.trim() ?? raw.trim();
}

function parseDateTime(raw: string): { date: string; timeStart: string | null; timeEnd: string | null } {
  const dateMatch = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) {
    throw new Error(`Cannot parse date: ${raw}`);
  }

  const year = dateMatch[1] ?? "";
  const month = (dateMatch[2] ?? "").padStart(2, "0");
  const day = (dateMatch[3] ?? "").padStart(2, "0");
  const date = `${year}-${month}-${day}`;

  const timeMatch = raw.match(/(\d{1,2}:\d{2})\s*\(GMT[^)]+\)\s*→\s*(\d{1,2}:\d{2})/);
  if (timeMatch) {
    return {
      date,
      timeStart: timeMatch[1] ?? null,
      timeEnd: timeMatch[2] ?? null,
    };
  }

  return { date, timeStart: null, timeEnd: null };
}

function parseSymptoms(raw: string): string[] | null {
  if (!raw.trim()) return null;
  const items = raw.split(/[,，]/).map((s) => s.trim()).filter((s) => s.length > 0);
  return items.length > 0 ? items : null;
}

function parseRow(row: CsvRow): ParsedVisit {
  const { date, timeStart, timeEnd } = parseDateTime(row.时间);

  return {
    visitType: row.类型,
    visitDate: date,
    visitTimeStart: timeStart,
    visitTimeEnd: timeEnd,
    visitReason: row.就诊原因,
    hospitalName: parseHospitalName(row.医院),
    doctorName: row.医生?.trim() || null,
    symptoms: parseSymptoms(row.检查项目),
    diagnosis: row.诊断?.trim() || null,
    treatment: row.治疗方案?.trim() || null,
  };
}

const workerUrl = process.env.SURETY_WORKER_URL;
const workerSecret = process.env.SURETY_WORKER_SECRET;

interface QueryResult<T> {
  success: boolean;
  results: T[];
  error?: string;
}

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!workerUrl || !workerSecret) {
    throw new Error("Missing SURETY_WORKER_URL or SURETY_WORKER_SECRET");
  }

  const res = await fetch(`${workerUrl}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${workerSecret}`,
    },
    body: JSON.stringify({ sql, params }),
  });

  const data: QueryResult<T> = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Query failed: ${res.status}`);
  }

  return data.results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: bun run scripts/import-medical-visits.ts <csv-path> <member-id>");
    process.exit(1);
  }

  const csvPath = args[0];
  const memberId = parseInt(args[1] ?? "", 10);

  if (!csvPath) {
    console.error("CSV path is required");
    process.exit(1);
  }

  if (isNaN(memberId)) {
    console.error("Invalid member ID");
    process.exit(1);
  }

  if (!workerUrl || !workerSecret) {
    console.error("Missing SURETY_WORKER_URL or SURETY_WORKER_SECRET");
    process.exit(1);
  }

  // Verify member exists
  const members = await query<{ id: number; name: string }>(
    "SELECT id, name FROM members WHERE id = ?",
    [memberId]
  );
  if (members.length === 0) {
    console.error(`Member with id=${memberId} not found`);
    process.exit(1);
  }
  const memberName = members[0]?.name ?? "Unknown";
  console.log(`Importing visits for member: ${memberName} (id=${memberId})`);

  // Read and parse CSV
  const csvContent = readFileSync(csvPath, "utf-8");
  const cleanContent = csvContent.replace(/^\uFEFF/, "");

  const rows: CsvRow[] = parse(cleanContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV`);

  const visits = rows.map(parseRow);

  // Collect unique hospitals and doctors
  const hospitals = new Map<string, number>();
  const doctors = new Map<string, { id: number; hospitalId: number }>();

  // Step 1: Create hospitals
  console.log("\n=== Creating Hospitals ===");
  const uniqueHospitals = [...new Set(visits.map((v) => v.hospitalName))];

  for (const name of uniqueHospitals) {
    try {
      const existing = await query<{ id: number }>(
        "SELECT id FROM hospitals WHERE name = ?",
        [name]
      );

      if (existing.length > 0) {
        const id = existing[0]?.id ?? 0;
        hospitals.set(name, id);
        console.log(`  [exists] ${name} (id=${id})`);
      } else {
        const result = await query<{ id: number }>(
          "INSERT INTO hospitals (name, is_public) VALUES (?, 1) RETURNING id",
          [name]
        );
        const id = result[0]?.id ?? 0;
        hospitals.set(name, id);
        console.log(`  [created] ${name} (id=${id})`);
      }
    } catch (err) {
      console.error(`  [error] ${name}:`, err);
    }
  }

  // Step 2: Create doctors
  console.log("\n=== Creating Doctors ===");
  const uniqueDoctors = new Set<string>();
  for (const v of visits) {
    if (v.doctorName) {
      uniqueDoctors.add(`${v.doctorName}@${v.hospitalName}`);
    }
  }

  for (const key of uniqueDoctors) {
    const [doctorName, hospitalName] = key.split("@");
    if (!doctorName || !hospitalName) continue;
    const hospitalId = hospitals.get(hospitalName);

    if (!hospitalId) {
      console.error(`  [error] Hospital not found for ${key}`);
      continue;
    }

    try {
      const existing = await query<{ id: number }>(
        "SELECT id FROM doctors WHERE name = ? AND hospital_id = ?",
        [doctorName, hospitalId]
      );

      if (existing.length > 0) {
        const id = existing[0]?.id ?? 0;
        doctors.set(key, { id, hospitalId });
        console.log(`  [exists] ${doctorName} @ ${hospitalName} (id=${id})`);
      } else {
        const result = await query<{ id: number }>(
          "INSERT INTO doctors (name, hospital_id, department) VALUES (?, ?, '儿科') RETURNING id",
          [doctorName, hospitalId]
        );
        const id = result[0]?.id ?? 0;
        doctors.set(key, { id, hospitalId });
        console.log(`  [created] ${doctorName} @ ${hospitalName} (id=${id})`);
      }
    } catch (err) {
      console.error(`  [error] ${key}:`, err);
    }
  }

  // Step 3: Create medical visits
  console.log("\n=== Creating Medical Visits ===");
  let created = 0;
  let skipped = 0;

  for (const visit of visits) {
    const hospitalId = hospitals.get(visit.hospitalName);
    if (!hospitalId) {
      console.error(`  [error] Hospital not found: ${visit.hospitalName}`);
      skipped++;
      continue;
    }

    let doctorId: number | null = null;
    if (visit.doctorName) {
      const doctorKey = `${visit.doctorName}@${visit.hospitalName}`;
      const doctor = doctors.get(doctorKey);
      doctorId = doctor?.id ?? null;
    }

    try {
      const existing = await query<{ id: number }>(
        "SELECT id FROM medical_visits WHERE member_id = ? AND visit_date = ? AND hospital_id = ? AND visit_reason = ?",
        [memberId, visit.visitDate, hospitalId, visit.visitReason]
      );

      if (existing.length > 0) {
        console.log(`  [exists] ${visit.visitDate} ${visit.visitReason}`);
        skipped++;
        continue;
      }

      const symptomsJson = visit.symptoms ? JSON.stringify(visit.symptoms) : null;

      await query<{ id: number }>(
        `INSERT INTO medical_visits (
          member_id, hospital_id, doctor_id, visit_date, visit_time_start, visit_time_end,
          visit_type, visit_reason, department, symptoms, diagnosis, treatment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '儿科', ?, ?, ?) RETURNING id`,
        [
          memberId,
          hospitalId,
          doctorId,
          visit.visitDate,
          visit.visitTimeStart,
          visit.visitTimeEnd,
          visit.visitType,
          visit.visitReason,
          symptomsJson,
          visit.diagnosis,
          visit.treatment,
        ]
      );

      console.log(`  [created] ${visit.visitDate} ${visit.visitReason}`);
      created++;
    } catch (err) {
      console.error(`  [error] ${visit.visitDate} ${visit.visitReason}:`, err);
      skipped++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Hospitals: ${hospitals.size}`);
  console.log(`Doctors: ${doctors.size}`);
  console.log(`Visits created: ${created}`);
  console.log(`Visits skipped: ${skipped}`);
}

main().catch(console.error);
