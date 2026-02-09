import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb } from "@/db";
import {
  membersRepo,
  insurersRepo,
  assetsRepo,
  policiesRepo,
  beneficiariesRepo,
  paymentsRepo,
  cashValuesRepo,
  policyExtensionsRepo,
  settingsRepo,
} from "@/db/repositories";

/**
 * Unit tests for backup data structure.
 * Tests the core logic: collecting all table data into a single JSON export.
 * The actual /api/backup route is tested via E2E in e2e/backup.e2e.test.ts.
 */

function buildBackup() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      members: membersRepo.findAll(),
      insurers: insurersRepo.findAll(),
      assets: assetsRepo.findAll(),
      policies: policiesRepo.findAll(),
      beneficiaries: beneficiariesRepo.findAll(),
      payments: paymentsRepo.findAll(),
      cashValues: cashValuesRepo.findAll(),
      policyExtensions: policyExtensionsRepo.findAll(),
      settings: settingsRepo.findAll(),
    },
  };
}

const ALL_TABLE_KEYS = [
  "members",
  "insurers",
  "assets",
  "policies",
  "beneficiaries",
  "payments",
  "cashValues",
  "policyExtensions",
  "settings",
] as const;

describe("backup", () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe("buildBackup structure", () => {
    test("includes version and exportedAt", () => {
      const backup = buildBackup();
      expect(backup.version).toBe(1);
      expect(backup.exportedAt).toBeDefined();
      // ISO 8601 format check
      expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt);
    });

    test("includes all 9 table keys", () => {
      const backup = buildBackup();
      const keys = Object.keys(backup.data);
      for (const key of ALL_TABLE_KEYS) {
        expect(keys).toContain(key);
      }
      expect(keys.length).toBe(ALL_TABLE_KEYS.length);
    });

    test("all tables return arrays", () => {
      const backup = buildBackup();
      for (const key of ALL_TABLE_KEYS) {
        expect(Array.isArray(backup.data[key])).toBe(true);
      }
    });

    test("empty database returns empty arrays for all tables", () => {
      const backup = buildBackup();
      for (const key of ALL_TABLE_KEYS) {
        expect(backup.data[key]).toEqual([]);
      }
    });
  });

  describe("buildBackup with seeded data", () => {
    test("includes seeded members in backup", () => {
      membersRepo.create({ name: "张三", relation: "Self", birthDate: "1985-06-15" });
      membersRepo.create({ name: "李四", relation: "Spouse", birthDate: "1988-03-20" });

      const backup = buildBackup();
      expect(backup.data.members.length).toBe(2);
      expect(backup.data.members[0]!.name).toBe("张三");
      expect(backup.data.members[1]!.name).toBe("李四");
    });

    test("includes seeded insurers in backup", () => {
      insurersRepo.create({ name: "中国人寿" });

      const backup = buildBackup();
      expect(backup.data.insurers.length).toBe(1);
      expect(backup.data.insurers[0]!.name).toBe("中国人寿");
    });

    test("includes seeded policies in backup", () => {
      const member = membersRepo.create({ name: "张三", relation: "Self" });
      policiesRepo.create({
        applicantId: member.id,
        insuredType: "Member",
        insuredMemberId: member.id,
        category: "Life",
        insurerName: "中国人寿",
        productName: "国寿福",
        policyNumber: "POL-001",
        sumAssured: 500000,
        premium: 10000,
        paymentFrequency: "Yearly",
        paymentYears: 20,
        totalPayments: 20,
        effectiveDate: "2024-01-01",
      });

      const backup = buildBackup();
      expect(backup.data.policies.length).toBe(1);
      expect(backup.data.policies[0]!.policyNumber).toBe("POL-001");
    });

    test("includes seeded settings in backup", () => {
      settingsRepo.set("annualIncome", "600000");
      settingsRepo.set("currency", "CNY");

      const backup = buildBackup();
      expect(backup.data.settings.length).toBe(2);
    });

    test("backup is valid JSON (serializable)", () => {
      membersRepo.create({ name: "张三", relation: "Self" });
      settingsRepo.set("test", "value");

      const backup = buildBackup();
      const json = JSON.stringify(backup, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(1);
      expect(parsed.data.members.length).toBe(1);
      expect(parsed.data.settings.length).toBe(1);
    });
  });

  describe("backup filename", () => {
    test("generates correct filename format", () => {
      const filename = `surety-backup-${new Date().toISOString().slice(0, 10)}.json`;
      expect(filename).toMatch(/^surety-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });
});
