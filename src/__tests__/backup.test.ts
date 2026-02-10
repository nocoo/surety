import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb, getRawSqlite } from "@/db";
import {
  membersRepo,
  insurersRepo,
  policiesRepo,
  settingsRepo,
  beneficiariesRepo,
  assetsRepo,
  paymentsRepo,
  cashValuesRepo,
  policyExtensionsRepo,
} from "@/db/repositories";
import {
  buildBackup,
  buildBackupFilename,
  restoreBackup,
  validateBackup,
  ALL_TABLE_KEYS,
  type BackupData,
} from "@/db/backup";

// ── Helpers ──────────────────────────────────────────────────────────

/** Seed a minimal family dataset via Drizzle repos. */
function seedFamily() {
  const m1 = membersRepo.create({ name: "张三", relation: "Self", birthDate: "1985-06-15" });
  const m2 = membersRepo.create({ name: "李四", relation: "Spouse", birthDate: "1988-03-20" });
  const insurer = insurersRepo.create({ name: "中国人寿" });
  const asset = assetsRepo.create({ type: "Vehicle", name: "沪A12345", identifier: "VIN-001", ownerId: m1.id });
  const policy = policiesRepo.create({
    applicantId: m1.id,
    insuredType: "Member",
    insuredMemberId: m1.id,
    category: "Life",
    insurerName: "中国人寿",
    insurerId: insurer.id,
    productName: "国寿福",
    policyNumber: "POL-001",
    sumAssured: 500000,
    premium: 10000,
    paymentFrequency: "Yearly",
    paymentYears: 20,
    totalPayments: 20,
    effectiveDate: "2024-01-01",
  });
  beneficiariesRepo.create({ policyId: policy.id, memberId: m2.id, sharePercent: 100, rankOrder: 1 });
  settingsRepo.set("annualIncome", "600000");
  settingsRepo.set("currency", "CNY");
  return { m1, m2, insurer, asset, policy };
}

/** Raw query helper — returns snake_case rows directly from SQLite. */
function rawQuery(table: string) {
  return getRawSqlite().prepare(`SELECT * FROM ${table}`).all();
}

// ── Tests ────────────────────────────────────────────────────────────

describe("backup service", () => {
  beforeEach(() => {
    resetTestDb();
  });

  // ── buildBackup ──

  describe("buildBackup", () => {
    test("includes version 1 and valid exportedAt", () => {
      const backup = buildBackup();
      expect(backup.version).toBe(1);
      expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt);
    });

    test("includes all 9 table keys", () => {
      const keys = Object.keys(buildBackup().data);
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

    test("empty database returns empty arrays", () => {
      const backup = buildBackup();
      for (const key of ALL_TABLE_KEYS) {
        expect(backup.data[key]).toEqual([]);
      }
    });

    test("uses snake_case column names (raw SQL format)", () => {
      seedFamily();
      const backup = buildBackup();
      const member = backup.data.members[0]!;
      // Should have snake_case keys from raw SQL
      expect(member).toHaveProperty("birth_date");
      expect(member).toHaveProperty("created_at");
      expect(member).not.toHaveProperty("birthDate");
      expect(member).not.toHaveProperty("createdAt");
    });

    test("timestamps are raw integers (not Date objects)", () => {
      seedFamily();
      const backup = buildBackup();
      const member = backup.data.members[0]!;
      expect(typeof member.created_at).toBe("number");
    });

    test("includes seeded members", () => {
      seedFamily();
      const backup = buildBackup();
      expect(backup.data.members.length).toBe(2);
      expect(backup.data.members[0]!.name).toBe("张三");
      expect(backup.data.members[1]!.name).toBe("李四");
    });

    test("includes seeded policies", () => {
      seedFamily();
      const backup = buildBackup();
      expect(backup.data.policies.length).toBe(1);
      expect(backup.data.policies[0]!.policy_number).toBe("POL-001");
    });

    test("includes seeded settings", () => {
      seedFamily();
      const backup = buildBackup();
      expect(backup.data.settings.length).toBe(2);
    });

    test("includes seeded beneficiaries", () => {
      seedFamily();
      const backup = buildBackup();
      expect(backup.data.beneficiaries.length).toBe(1);
    });

    test("includes seeded assets", () => {
      seedFamily();
      const backup = buildBackup();
      expect(backup.data.assets.length).toBe(1);
      expect(backup.data.assets[0]!.name).toBe("沪A12345");
    });

    test("backup is JSON-serializable roundtrip", () => {
      seedFamily();
      const backup = buildBackup();
      const json = JSON.stringify(backup, null, 2);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.data.members.length).toBe(2);
      expect(parsed.data.policies.length).toBe(1);
      expect(parsed.data.settings.length).toBe(2);
    });
  });

  // ── buildBackupFilename ──

  describe("buildBackupFilename", () => {
    test("matches surety-backup-YYYY-MM-DD.json format", () => {
      const filename = buildBackupFilename();
      expect(filename).toMatch(/^surety-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  // ── validateBackup ──

  describe("validateBackup", () => {
    test("null payload is invalid", () => {
      expect(validateBackup(null)).toBe("Payload is not an object");
    });

    test("wrong version is invalid", () => {
      expect(validateBackup({ version: 99, data: {} })).toMatch(/Unsupported backup version/);
    });

    test("missing data is invalid", () => {
      expect(validateBackup({ version: 1 })).toBe("Missing 'data' field");
    });

    test("non-array table value is invalid", () => {
      expect(validateBackup({ version: 1, data: { members: "not-array" } })).toMatch(
        /data\.members must be an array/,
      );
    });

    test("valid payload passes", () => {
      expect(validateBackup({ version: 1, data: {} })).toBeNull();
    });

    test("valid payload with empty arrays passes", () => {
      const data: Record<string, unknown[]> = {};
      for (const key of ALL_TABLE_KEYS) data[key] = [];
      expect(validateBackup({ version: 1, data })).toBeNull();
    });
  });

  // ── restoreBackup ──

  describe("restoreBackup", () => {
    test("restoring into empty db inserts all data", () => {
      seedFamily();
      const backup = buildBackup();

      // clear everything
      resetTestDb();
      expect(rawQuery("members")).toEqual([]);

      // restore
      const counts = restoreBackup(backup);

      expect(counts.members).toBe(2);
      expect(counts.insurers).toBe(1);
      expect(counts.assets).toBe(1);
      expect(counts.policies).toBe(1);
      expect(counts.beneficiaries).toBe(1);
      expect(counts.settings).toBe(2);

      // verify via raw SQL
      const members = rawQuery("members");
      expect(members.length).toBe(2);
      expect((members[0] as { name: string }).name).toBe("张三");
    });

    test("restore replaces existing data (full overwrite)", () => {
      // seed backup source
      seedFamily();
      const backup = buildBackup();

      // reset and add different data
      resetTestDb();
      membersRepo.create({ name: "旧数据", relation: "Self" });
      membersRepo.create({ name: "旧数据2", relation: "Spouse" });
      expect(rawQuery("members").length).toBe(2);

      // restore should replace everything
      restoreBackup(backup);
      const members = rawQuery("members");
      expect(members.length).toBe(2);
      expect((members[0] as { name: string }).name).toBe("张三");
      expect((members[1] as { name: string }).name).toBe("李四");
    });

    test("restore preserves original IDs", () => {
      seedFamily();
      const backup = buildBackup();
      const originalIds = backup.data.members.map((m) => m.id);

      resetTestDb();
      restoreBackup(backup);

      const restoredIds = rawQuery("members").map((m: unknown) => (m as { id: number }).id);
      expect(restoredIds).toEqual(originalIds);
    });

    test("restore preserves FK relationships", () => {
      seedFamily();
      const backup = buildBackup();

      resetTestDb();
      restoreBackup(backup);

      const policies = rawQuery("policies") as { applicant_id: number }[];
      const members = rawQuery("members") as { id: number }[];
      const memberIds = members.map((m) => m.id);
      // policy's applicant_id should match a member's id
      expect(memberIds).toContain(policies[0]!.applicant_id);
    });

    test("restore with empty data clears everything", () => {
      seedFamily();
      expect(rawQuery("members").length).toBe(2);

      const emptyBackup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          members: [],
          insurers: [],
          assets: [],
          policies: [],
          beneficiaries: [],
          payments: [],
          cashValues: [],
          policyExtensions: [],
          settings: [],
        },
      };

      restoreBackup(emptyBackup);
      expect(rawQuery("members")).toEqual([]);
      expect(rawQuery("policies")).toEqual([]);
      expect(rawQuery("settings")).toEqual([]);
    });

    test("restore throws on invalid payload", () => {
      expect(() => restoreBackup({ version: 99 } as BackupData)).toThrow(/Invalid backup/);
    });

    test("roundtrip: export → restore → export produces identical data", () => {
      seedFamily();
      const backup1 = buildBackup();

      resetTestDb();
      restoreBackup(backup1);
      const backup2 = buildBackup();

      // Compare data (ignore exportedAt timestamp)
      expect(backup2.data.members).toEqual(backup1.data.members);
      expect(backup2.data.insurers).toEqual(backup1.data.insurers);
      expect(backup2.data.assets).toEqual(backup1.data.assets);
      expect(backup2.data.policies).toEqual(backup1.data.policies);
      expect(backup2.data.beneficiaries).toEqual(backup1.data.beneficiaries);
      expect(backup2.data.payments).toEqual(backup1.data.payments);
      expect(backup2.data.cashValues).toEqual(backup1.data.cashValues);
      expect(backup2.data.policyExtensions).toEqual(backup1.data.policyExtensions);
      expect(backup2.data.settings).toEqual(backup1.data.settings);
    });

    test("restore handles payments, cashValues, and policyExtensions", () => {
      const m = membersRepo.create({ name: "Test", relation: "Self" });
      const p = policiesRepo.create({
        applicantId: m.id,
        insuredType: "Member",
        insuredMemberId: m.id,
        category: "Life",
        insurerName: "Test Insurer",
        productName: "Test Product",
        policyNumber: "POL-TEST",
        sumAssured: 100000,
        premium: 5000,
        paymentFrequency: "Yearly",
        effectiveDate: "2025-01-01",
      });
      paymentsRepo.create({
        policyId: p.id,
        periodNumber: 1,
        dueDate: "2025-01-01",
        amount: 5000,
        status: "Paid",
      });
      cashValuesRepo.create({ policyId: p.id, policyYear: 1, value: 3000 });
      policyExtensionsRepo.create({ policyId: p.id, data: JSON.stringify({ deductible: 10000 }) });

      const backup = buildBackup();
      expect(backup.data.payments.length).toBe(1);
      expect(backup.data.cashValues.length).toBe(1);
      expect(backup.data.policyExtensions.length).toBe(1);

      resetTestDb();
      const counts = restoreBackup(backup);
      expect(counts.payments).toBe(1);
      expect(counts.cashValues).toBe(1);
      expect(counts.policyExtensions).toBe(1);

      expect(rawQuery("payments").length).toBe(1);
      expect(rawQuery("cash_values").length).toBe(1);
      expect(rawQuery("policy_extensions").length).toBe(1);
    });

    test("restore is atomic: failed insert rolls back all changes", () => {
      seedFamily();
      const backup = buildBackup();

      resetTestDb();
      membersRepo.create({ name: "Should survive", relation: "Self" });

      // Corrupt the backup: duplicate policy_number will violate UNIQUE constraint
      const corruptBackup = JSON.parse(JSON.stringify(backup)) as BackupData;
      if (corruptBackup.data.policies.length > 0) {
        corruptBackup.data.policies.push({ ...corruptBackup.data.policies[0]! });
      }

      expect(() => restoreBackup(corruptBackup)).toThrow();

      // After rollback, the original data should still be intact
      const members = rawQuery("members") as { name: string }[];
      expect(members.length).toBe(1);
      expect(members[0]!.name).toBe("Should survive");
    });
  });
});
