# 15. Medical Visits Module

## Overview

Add a standalone medical visits module to track family members' healthcare records. The module includes hospitals, doctors, and visit records, reusing the existing `members` table for patient information.

**Scope (v1)**: Single-day visits only (门诊/急诊/儿保/体检/复查/预约). Hospitalization (住院) is **excluded** from v1 — requires different time model (admit/discharge dates).

## Data Model

### Entity Relationship

```
members ─< medicalVisits >─ hospitals
                │                │
                └── doctors ────┘
                
Constraint: doctor.hospital_id === medicalVisits.hospital_id
```

### 1. hospitals

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTO_INCREMENT | |
| name | TEXT | NOT NULL | Hospital name (允许重名，通过地址/备注区分) |
| level | TEXT | ENUM | 三甲/三乙/二甲/二乙/一级/社区/诊所/未评级 |
| is_public | INTEGER | BOOLEAN, DEFAULT true | Public or private |
| address | TEXT | | Address (用于区分同名医院) |
| phone | TEXT | | Phone number |
| notes | TEXT | | Notes |
| created_at | INTEGER | TIMESTAMP, NOT NULL | |
| updated_at | INTEGER | TIMESTAMP, NOT NULL | |

### 2. doctors

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTO_INCREMENT | |
| name | TEXT | NOT NULL | Doctor name |
| hospital_id | INTEGER | FK → hospitals.id, NOT NULL | |
| department | TEXT | NOT NULL | Department |
| title | TEXT | ENUM | 主任医师/副主任医师/主治医师/住院医师/其他 |
| specialty | TEXT | | Specialty/expertise |
| phone | TEXT | | Contact phone |
| notes | TEXT | | Notes |
| created_at | INTEGER | TIMESTAMP, NOT NULL | |
| updated_at | INTEGER | TIMESTAMP, NOT NULL | |

### 3. medical_visits

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTO_INCREMENT | |
| member_id | INTEGER | FK → members.id, NOT NULL | Patient (就诊人) |
| hospital_id | INTEGER | FK → hospitals.id, NOT NULL | Hospital (医院) |
| doctor_id | INTEGER | FK → doctors.id | Doctor (医生, optional) |
| visit_date | TEXT | NOT NULL | ISO date: "2025-03-26" |
| visit_time_start | TEXT | | Start time: "10:00" |
| visit_time_end | TEXT | | End time: "11:30" |
| visit_type | TEXT | ENUM, NOT NULL | 儿保/门诊/急诊/体检/复查/预约 (v1 无住院) |
| visit_reason | TEXT | NOT NULL | 就诊原因: "1月龄儿保", "便血", "随诊" |
| department | TEXT | | Department (科室) |
| symptoms | TEXT | | 症状/性质 (JSON array): ["便血", "喂养"] |
| diagnosis | TEXT | | 诊断结果 |
| assessment | TEXT | | 评估结果 |
| treatment | TEXT | | 治疗方案 |
| total_cost | REAL | | Total cost (总费用) |
| insurance_paid | REAL | | Social insurance paid (医保支付) |
| self_paid | REAL | | Out-of-pocket (自付) |
| notes | TEXT | | Notes (备注) |
| created_at | INTEGER | TIMESTAMP, NOT NULL | |
| updated_at | INTEGER | TIMESTAMP, NOT NULL | |

### Computed Fields (UI Layer)

| Field | Calculation | Description |
|-------|-------------|-------------|
| memberAgeMonths | `(visitDate - member.birthDate)` in months | 月龄 |
| daysSinceVisit | `(today - visitDate)` in days | 距今天数 |
| visitTimeRange | `${visit_time_start} → ${visit_time_end}` | 时间段显示 |

### Data Constraints

#### Server-side Validation (API Layer)

1. **Doctor-Hospital Consistency**: When `doctor_id` is provided, API must verify `doctor.hospital_id === medical_visits.hospital_id`. Return 400 if mismatch.

2. **Cost Consistency** (optional fields):
   - If all three cost fields are provided: `total_cost === insurance_paid + self_paid`
   - If only partial: no validation (allow incomplete data entry)
   - API returns 400 if math doesn't add up when all three are present

3. **Visit Type Scope**: Only allow `儿保/门诊/急诊/体检/复查/预约`. Reject `住院` with 400.

---

## File Changes

### Phase 1: Data Layer

| File | Action | Description |
|------|--------|-------------|
| `src/db/schema.ts` | MODIFY | Add hospitals, doctors, medicalVisits tables |
| `src/db/repositories/hospitals.ts` | CREATE | Hospital repository |
| `src/db/repositories/doctors.ts` | CREATE | Doctor repository |
| `src/db/repositories/medicalVisits.ts` | CREATE | Medical visit repository |
| `src/db/repositories/index.ts` | MODIFY | Register new repositories |

### Phase 2: Infrastructure (横切改造)

| File | Action | Description |
|------|--------|-------------|
| `src/db/backup.ts` | MODIFY | Add to BackupData, RestoreCounts, ALL_TABLE_KEYS, TABLE_NAME_MAP, SCHEMA_TABLE_MAP, DELETE_ORDER, INSERT_ORDER, BOOLEAN_COLUMNS |
| `src/db/index.ts` | MODIFY | Add CREATE TABLE to `initSchema()`, add DELETE to `resetTestDb()` |

**backup.ts Changes:**

```typescript
// BackupData.data - add:
hospitals: BackupRow[];
doctors: BackupRow[];
medicalVisits: BackupRow[];

// RestoreCounts - add:
hospitals: number;
doctors: number;
medicalVisits: number;

// ALL_TABLE_KEYS - add (order matters for display):
"hospitals",
"doctors", 
"medicalVisits",

// TABLE_NAME_MAP - add:
hospitals: "hospitals",
doctors: "doctors",
medicalVisits: "medical_visits",

// SCHEMA_TABLE_MAP - add:
hospitals: schema.hospitals,
doctors: schema.doctors,
medicalVisits: schema.medicalVisits,

// BOOLEAN_COLUMNS - add:
"isPublic"

// DELETE_ORDER - prepend (children first):
"medicalVisits",  // depends on members, hospitals, doctors
"doctors",        // depends on hospitals
"hospitals",      // no dependencies (but must delete after doctors)

// INSERT_ORDER - append (parents first):
"hospitals",      // no dependencies
"doctors",        // after hospitals
"medicalVisits",  // after members, hospitals, doctors
```

**index.ts initSchema() - add:**

```sql
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level TEXT,
  is_public INTEGER DEFAULT 1,
  address TEXT,
  phone TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
  department TEXT NOT NULL,
  title TEXT,
  specialty TEXT,
  phone TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS medical_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
  doctor_id INTEGER REFERENCES doctors(id),
  visit_date TEXT NOT NULL,
  visit_time_start TEXT,
  visit_time_end TEXT,
  visit_type TEXT NOT NULL,
  visit_reason TEXT NOT NULL,
  department TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  assessment TEXT,
  treatment TEXT,
  total_cost REAL,
  insurance_paid REAL,
  self_paid REAL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**index.ts resetTestDb() - add (before members):**

```sql
DELETE FROM medical_visits;
DELETE FROM doctors;
DELETE FROM hospitals;
```

### Phase 3: API Routes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/hospitals/route.ts` | CREATE | GET (list) / POST (create) |
| `src/app/api/hospitals/[id]/route.ts` | CREATE | GET / PUT / DELETE |
| `src/app/api/doctors/route.ts` | CREATE | GET (list, filter by hospitalId) / POST |
| `src/app/api/doctors/[id]/route.ts` | CREATE | GET / PUT / DELETE |
| `src/app/api/medical-visits/route.ts` | CREATE | GET (list, filter by memberId) / POST (with doctor-hospital validation) |
| `src/app/api/medical-visits/[id]/route.ts` | CREATE | GET / PUT (with doctor-hospital validation) / DELETE |
| `src/app/api/members/[id]/route.ts` | MODIFY | Add medicalVisits FK check to DELETE |

**members/[id]/route.ts DELETE - add check:**

```typescript
// After checking policies, add:
const visits = await repos.medicalVisits.findByMemberId(memberId);
if (visits.length > 0) {
  return NextResponse.json(
    { error: `该成员有 ${visits.length} 条就诊记录，无法删除` },
    { status: 409 }
  );
}
```

### Phase 4: UI Layer

| File | Action | Description |
|------|--------|-------------|
| `src/lib/navigation.ts` | MODIFY | Add "就诊管理" nav group |
| `src/components/layout/sidebar.tsx` | MODIFY | Add Stethoscope/Hospital/UserRound to ICON_MAP |
| `src/app/hospitals/page.tsx` | CREATE | Hospital list page |
| `src/app/hospitals/hospital-sheet.tsx` | CREATE | Hospital form sheet |
| `src/app/doctors/page.tsx` | CREATE | Doctor list page |
| `src/app/doctors/doctor-sheet.tsx` | CREATE | Doctor form sheet |
| `src/app/medical-visits/page.tsx` | CREATE | Visit list page with member filter |
| `src/app/medical-visits/visit-sheet.tsx` | CREATE | Visit form sheet |

---

## Implementation Details

### Repository Pattern

Follow existing pattern in `src/db/repositories/`:

```typescript
export function createHospitalsRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Hospital[]> { ... },
    async findById(id: number): Promise<Hospital | undefined> { ... },
    async create(data: NewHospital): Promise<Hospital> { ... },
    async update(id: number, data: Partial<NewHospital>): Promise<Hospital | undefined> { ... },
    async delete(id: number): Promise<boolean> { ... },
  };
}
```

### API Delete Constraints

Before deleting:
- **Hospital**: Check for linked doctors and visits → 409 Conflict
- **Doctor**: Check for linked visits → 409 Conflict
- **Member** (existing, needs modification): Check for linked visits → 409 Conflict

### API Create/Update Validation

**POST/PUT /api/medical-visits:**

```typescript
// Validate doctor belongs to selected hospital
if (body.doctorId) {
  const doctor = await repos.doctors.findById(body.doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 400 });
  }
  if (doctor.hospitalId !== body.hospitalId) {
    return NextResponse.json(
      { error: "所选医生不属于该医院" },
      { status: 400 }
    );
  }
}

// Validate cost consistency (only when all three provided)
if (body.totalCost != null && body.insurancePaid != null && body.selfPaid != null) {
  const expected = body.insurancePaid + body.selfPaid;
  if (Math.abs(body.totalCost - expected) > 0.01) {
    return NextResponse.json(
      { error: "费用不一致：总费用 ≠ 医保支付 + 自付金额" },
      { status: 400 }
    );
  }
}

// Validate visit_type
const ALLOWED_VISIT_TYPES = ["儿保", "门诊", "急诊", "体检", "复查", "预约"];
if (!ALLOWED_VISIT_TYPES.includes(body.visitType)) {
  return NextResponse.json(
    { error: `不支持的就诊类型: ${body.visitType}` },
    { status: 400 }
  );
}
```

### Navigation Structure

**src/lib/navigation.ts:**

```typescript
{
  label: "就诊管理",
  defaultOpen: true,
  items: [
    { href: "/medical-visits", label: "就诊记录", icon: "Stethoscope" },
    { href: "/hospitals", label: "医院管理", icon: "Hospital" },
    { href: "/doctors", label: "医生管理", icon: "UserRound" },
  ],
}
```

**src/components/layout/sidebar.tsx ICON_MAP:**

```typescript
import { Stethoscope, Hospital, UserRound } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  // ... existing icons ...
  Stethoscope,
  Hospital,
  UserRound,
};
```

### UI Features

1. **Hospital Page**: Basic CRUD with level/public filters
2. **Doctor Page**: CRUD with hospital dropdown, filter by hospital
3. **Medical Visits Page** (主要页面):
   - **表格列**: 类型 | 月龄 | 距今 | 时间 | 就诊原因 | 医院 | 医生 | 性质/症状 | 诊断 | 评估 | 治疗方案
   - Member filter dropdown (筛选就诊人)
   - Visit type color badges (儿保=绿色, 门诊=橙色, 急诊=红色)
   - Symptoms as colored tags
   - Computed fields: 月龄、距今天数
   - Sort by visit_date descending (最新在前)
4. **Visit Form Sheet**:
   - Member dropdown (就诊人)
   - Hospital/doctor cascading dropdowns (选医院后筛选医生)
   - Date + time range pickers
   - Visit type selector
   - Symptoms multi-select/tags input
   - Diagnosis, assessment, treatment textareas
   - Cost breakdown (optional, with consistency hint)

---

## Verification

1. **Schema**: `bun run db:push` → verify tables in `bun run db:studio`
2. **Unit Tests**: 
   - Repository tests for new tables
   - Verify `resetTestDb()` clears new tables
   - Verify `initSchema()` creates new tables
3. **Backup/Restore Tests**:
   - Add test data for hospitals/doctors/medicalVisits
   - Verify `buildBackup()` includes new tables
   - Verify `restoreBackup()` restores new tables
4. **API Tests**: 
   - CRUD for all three entities
   - Doctor-hospital validation (expect 400)
   - Cost consistency validation
   - Delete constraint tests (expect 409)
   - Member delete with visits (expect 409)
5. **UI Tests**: Manual verification of all pages
6. **E2E Tests**: Add to existing E2E suite

---

## Future Extensions (v2+)

- **住院记录**: 需要 `admitted_on` / `discharged_on` 时间模型
- **理赔联动**: 就诊记录关联保单，计算理赔金额
- **费用统计**: 按成员/时间维度汇总医疗支出
- **提醒功能**: 复查/预约就诊提醒
- **附件上传**: 病历/检查报告上传到 R2
