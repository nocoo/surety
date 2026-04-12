import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import {
  medicalVisitsRepo,
  hospitalsRepo,
  doctorsRepo,
  membersRepo,
} from "@/db/repositories";

describe("medicalVisitsRepo", () => {
  let memberId: number;
  let hospitalId: number;
  let doctorId: number;

  beforeEach(async () => {
    resetTestDb();

    const member = await membersRepo.create({
      name: "宝宝",
      relation: "Child",
      birthDate: "2024-02-15",
    });
    memberId = member.id;

    const hospital = await hospitalsRepo.create({ name: "北京协和医院" });
    hospitalId = hospital.id;

    const doctor = await doctorsRepo.create({
      name: "张医生",
      hospitalId,
      department: "儿科",
    });
    doctorId = doctor.id;
  });

  describe("create", () => {
    test("creates a visit with required fields", async () => {
      const visit = await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-26",
        visitType: "儿保",
        visitReason: "1月龄儿保",
      });

      expect(visit.id).toBeGreaterThan(0);
      expect(visit.memberId).toBe(memberId);
      expect(visit.hospitalId).toBe(hospitalId);
      expect(visit.doctorId).toBeNull();
      expect(visit.visitDate).toBe("2025-03-26");
      expect(visit.visitType).toBe("儿保");
      expect(visit.visitReason).toBe("1月龄儿保");
      expect(visit.visitTimeStart).toBeNull();
      expect(visit.visitTimeEnd).toBeNull();
      expect(visit.department).toBeNull();
      expect(visit.symptoms).toBeNull();
      expect(visit.diagnosis).toBeNull();
      expect(visit.assessment).toBeNull();
      expect(visit.treatment).toBeNull();
      expect(visit.totalCost).toBeNull();
      expect(visit.insurancePaid).toBeNull();
      expect(visit.selfPaid).toBeNull();
      expect(visit.notes).toBeNull();
      expect(visit.createdAt).toBeInstanceOf(Date);
      expect(visit.updatedAt).toBeInstanceOf(Date);
    });

    test("creates a visit with all fields", async () => {
      const visit = await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        doctorId,
        visitDate: "2025-03-26",
        visitTimeStart: "10:00",
        visitTimeEnd: "11:30",
        visitType: "门诊",
        visitReason: "便血",
        department: "儿科",
        symptoms: JSON.stringify(["便血", "腹痛"]),
        diagnosis: "肠炎",
        assessment: "轻度",
        treatment: "益生菌、休息",
        totalCost: 500.0,
        insurancePaid: 300.0,
        selfPaid: 200.0,
        notes: "需要复查",
      });

      expect(visit.doctorId).toBe(doctorId);
      expect(visit.visitTimeStart).toBe("10:00");
      expect(visit.visitTimeEnd).toBe("11:30");
      expect(visit.visitType).toBe("门诊");
      expect(visit.department).toBe("儿科");
      expect(visit.symptoms).toBe(JSON.stringify(["便血", "腹痛"]));
      expect(visit.diagnosis).toBe("肠炎");
      expect(visit.assessment).toBe("轻度");
      expect(visit.treatment).toBe("益生菌、休息");
      expect(visit.totalCost).toBe(500.0);
      expect(visit.insurancePaid).toBe(300.0);
      expect(visit.selfPaid).toBe(200.0);
      expect(visit.notes).toBe("需要复查");
    });

    test("creates visits with different types", async () => {
      const types = ["儿保", "门诊", "急诊", "体检", "复查", "预约"] as const;

      for (const type of types) {
        const visit = await medicalVisitsRepo.create({
          memberId,
          hospitalId,
          visitDate: "2025-03-26",
          visitType: type,
          visitReason: `${type}测试`,
        });
        expect(visit.visitType).toBe(type);
      }
    });
  });

  describe("findAll", () => {
    test("returns empty array when no visits", async () => {
      const visits = await medicalVisitsRepo.findAll();
      expect(visits).toEqual([]);
    });

    test("returns all visits ordered by visitDate desc", async () => {
      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-01",
        visitType: "儿保",
        visitReason: "早期",
      });
      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-15",
        visitType: "门诊",
        visitReason: "中期",
      });
      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-10",
        visitType: "急诊",
        visitReason: "中间",
      });

      const visits = await medicalVisitsRepo.findAll();
      expect(visits).toHaveLength(3);
      // Ordered by visitDate desc - after toHaveLength(3), array indices are safe
      const [first, second, third] = visits;
      expect(first?.visitDate).toBe("2025-03-15");
      expect(second?.visitDate).toBe("2025-03-10");
      expect(third?.visitDate).toBe("2025-03-01");
    });
  });

  describe("findById", () => {
    test("returns visit when found", async () => {
      const created = await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-26",
        visitType: "儿保",
        visitReason: "1月龄儿保",
      });

      const found = await medicalVisitsRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.visitReason).toBe("1月龄儿保");
    });

    test("returns undefined when not found", async () => {
      const found = await medicalVisitsRepo.findById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("findByMemberId", () => {
    test("returns visits of specific member ordered by visitDate desc", async () => {
      const member2 = await membersRepo.create({
        name: "妈妈",
        relation: "Self",
      });

      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-01",
        visitType: "儿保",
        visitReason: "宝宝就诊1",
      });
      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-15",
        visitType: "门诊",
        visitReason: "宝宝就诊2",
      });
      await medicalVisitsRepo.create({
        memberId: member2.id,
        hospitalId,
        visitDate: "2025-03-10",
        visitType: "体检",
        visitReason: "妈妈就诊",
      });

      const visits = await medicalVisitsRepo.findByMemberId(memberId);
      expect(visits).toHaveLength(2);
      expect(visits.every((v) => v.memberId === memberId)).toBe(true);
      // Ordered by visitDate desc
      const [first, second] = visits;
      expect(first?.visitDate).toBe("2025-03-15");
      expect(second?.visitDate).toBe("2025-03-01");
    });

    test("returns empty array when no visits for member", async () => {
      const visits = await medicalVisitsRepo.findByMemberId(memberId);
      expect(visits).toEqual([]);
    });
  });

  describe("findByHospitalId", () => {
    test("returns visits of specific hospital", async () => {
      const hospital2 = await hospitalsRepo.create({ name: "北京儿童医院" });

      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-01",
        visitType: "儿保",
        visitReason: "协和就诊",
      });
      await medicalVisitsRepo.create({
        memberId,
        hospitalId: hospital2.id,
        visitDate: "2025-03-10",
        visitType: "门诊",
        visitReason: "儿童医院就诊",
      });

      const visits = await medicalVisitsRepo.findByHospitalId(hospitalId);
      expect(visits).toHaveLength(1);
      const [visit] = visits;
      expect(visit?.visitReason).toBe("协和就诊");
    });
  });

  describe("findByDoctorId", () => {
    test("returns visits of specific doctor", async () => {
      const doctor2 = await doctorsRepo.create({
        name: "李医生",
        hospitalId,
        department: "内科",
      });

      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        doctorId,
        visitDate: "2025-03-01",
        visitType: "儿保",
        visitReason: "张医生看诊",
      });
      await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        doctorId: doctor2.id,
        visitDate: "2025-03-10",
        visitType: "门诊",
        visitReason: "李医生看诊",
      });

      const visits = await medicalVisitsRepo.findByDoctorId(doctorId);
      expect(visits).toHaveLength(1);
      const [visit] = visits;
      expect(visit?.visitReason).toBe("张医生看诊");
    });
  });

  describe("update", () => {
    test("updates visit fields", async () => {
      const visit = await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-26",
        visitType: "儿保",
        visitReason: "1月龄儿保",
      });

      const updated = await medicalVisitsRepo.update(visit.id, {
        diagnosis: "发育正常",
        assessment: "良好",
        treatment: "继续观察",
      });

      expect(updated?.diagnosis).toBe("发育正常");
      expect(updated?.assessment).toBe("良好");
      expect(updated?.treatment).toBe("继续观察");
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        visit.updatedAt.getTime()
      );
    });

    test("returns undefined when visit not found", async () => {
      const updated = await medicalVisitsRepo.update(999, { diagnosis: "test" });
      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes visit and returns true", async () => {
      const visit = await medicalVisitsRepo.create({
        memberId,
        hospitalId,
        visitDate: "2025-03-26",
        visitType: "儿保",
        visitReason: "1月龄儿保",
      });

      const result = await medicalVisitsRepo.delete(visit.id);
      expect(result).toBe(true);

      const found = await medicalVisitsRepo.findById(visit.id);
      expect(found).toBeUndefined();
    });

    test("returns false when visit not found", async () => {
      const result = await medicalVisitsRepo.delete(999);
      expect(result).toBe(false);
    });
  });
});
