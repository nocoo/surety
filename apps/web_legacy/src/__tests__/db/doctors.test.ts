import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@surety/db";
import { doctorsRepo, hospitalsRepo } from "@surety/db/repositories";

describe("doctorsRepo", () => {
  let hospitalId: number;

  beforeEach(async () => {
    resetTestDb();
    const hospital = await hospitalsRepo.create({ name: "北京协和医院" });
    hospitalId = hospital.id;
  });

  describe("create", () => {
    test("creates a doctor with required fields", async () => {
      const doctor = await doctorsRepo.create({
        name: "张医生",
        hospitalId,
        department: "儿科",
      });

      expect(doctor.id).toBeGreaterThan(0);
      expect(doctor.name).toBe("张医生");
      expect(doctor.hospitalId).toBe(hospitalId);
      expect(doctor.department).toBe("儿科");
      expect(doctor.title).toBeNull();
      expect(doctor.specialty).toBeNull();
      expect(doctor.phone).toBeNull();
      expect(doctor.notes).toBeNull();
      expect(doctor.createdAt).toBeInstanceOf(Date);
      expect(doctor.updatedAt).toBeInstanceOf(Date);
    });

    test("creates a doctor with all fields", async () => {
      const doctor = await doctorsRepo.create({
        name: "李主任",
        hospitalId,
        department: "内科",
        title: "主任医师",
        specialty: "心血管疾病",
        phone: "13800138000",
        notes: "每周一上午出诊",
      });

      expect(doctor.name).toBe("李主任");
      expect(doctor.title).toBe("主任医师");
      expect(doctor.specialty).toBe("心血管疾病");
      expect(doctor.phone).toBe("13800138000");
      expect(doctor.notes).toBe("每周一上午出诊");
    });
  });

  describe("findAll", () => {
    test("returns empty array when no doctors", async () => {
      const doctors = await doctorsRepo.findAll();
      expect(doctors).toEqual([]);
    });

    test("returns all doctors", async () => {
      await doctorsRepo.create({ name: "张医生", hospitalId, department: "儿科" });
      await doctorsRepo.create({ name: "李医生", hospitalId, department: "内科" });

      const doctors = await doctorsRepo.findAll();
      expect(doctors).toHaveLength(2);
    });
  });

  describe("findById", () => {
    test("returns doctor when found", async () => {
      const created = await doctorsRepo.create({
        name: "张医生",
        hospitalId,
        department: "儿科",
      });

      const found = await doctorsRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("张医生");
    });

    test("returns undefined when not found", async () => {
      const found = await doctorsRepo.findById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("findByHospitalId", () => {
    test("returns doctors of specific hospital", async () => {
      const hospital2 = await hospitalsRepo.create({ name: "北京儿童医院" });

      await doctorsRepo.create({ name: "张医生", hospitalId, department: "儿科" });
      await doctorsRepo.create({ name: "李医生", hospitalId, department: "内科" });
      await doctorsRepo.create({
        name: "王医生",
        hospitalId: hospital2.id,
        department: "眼科",
      });

      const doctors = await doctorsRepo.findByHospitalId(hospitalId);
      expect(doctors).toHaveLength(2);
      expect(doctors.every((d) => d.hospitalId === hospitalId)).toBe(true);
    });

    test("returns empty array when no doctors in hospital", async () => {
      const doctors = await doctorsRepo.findByHospitalId(hospitalId);
      expect(doctors).toEqual([]);
    });
  });

  describe("update", () => {
    test("updates doctor fields", async () => {
      const doctor = await doctorsRepo.create({
        name: "张医生",
        hospitalId,
        department: "儿科",
      });

      const updated = await doctorsRepo.update(doctor.id, {
        title: "副主任医师",
        specialty: "新生儿护理",
      });

      expect(updated?.title).toBe("副主任医师");
      expect(updated?.specialty).toBe("新生儿护理");
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        doctor.updatedAt.getTime()
      );
    });

    test("returns undefined when doctor not found", async () => {
      const updated = await doctorsRepo.update(999, { title: "主任医师" });
      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes doctor and returns true", async () => {
      const doctor = await doctorsRepo.create({
        name: "张医生",
        hospitalId,
        department: "儿科",
      });

      const result = await doctorsRepo.delete(doctor.id);
      expect(result).toBe(true);

      const found = await doctorsRepo.findById(doctor.id);
      expect(found).toBeUndefined();
    });

    test("returns false when doctor not found", async () => {
      const result = await doctorsRepo.delete(999);
      expect(result).toBe(false);
    });
  });
});
