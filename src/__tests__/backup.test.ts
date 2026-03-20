import { describe, expect, test, beforeEach } from "bun:test";
import { resetTestDb, getRawSqlite, createTestDb } from "@/db";
import {
  membersRepo,
  insurersRepo,
  policiesRepo,
  settingsRepo,
  beneficiariesRepo,
  assetsRepo,
  paymentsRepo,
  cashValuesRepo,
} from "@/db/repositories";
import {
  buildBackup,
  buildBackupFilename,
  restoreBackup,
  validateBackup,
  ALL_TABLE_KEYS,
  type BackupData,
} from "@/db/backup";
import type { DbInstance } from "@/db";

// ── Helpers ──────────────────────────────────────────────────────────

/** Get the test db instance for passing to backup/restore. */
function getTestDb(): DbInstance {
  // createTestDb() returns the Drizzle db instance backed by test :memory:
  return createTestDb();
}

/** Seed a minimal family dataset via Drizzle repos. */
async function seedFamily() {
  const m1 = await membersRepo.create({ name: "张三", relation: "Self", birthDate: "1985-06-15" });
  const m2 = await membersRepo.create({ name: "李四", relation: "Spouse", birthDate: "1988-03-20" });
  const insurer = await insurersRepo.create({ name: "中国人寿" });
  const asset = await assetsRepo.create({ type: "Vehicle", name: "沪A12345", identifier: "VIN-001", ownerId: m1.id });
  const policy = await policiesRepo.create({
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
  await beneficiariesRepo.create({ policyId: policy.id, memberId: m2.id, sharePercent: 100, rankOrder: 1 });
  await settingsRepo.set("annualIncome", "600000");
  await settingsRepo.set("currency", "CNY");
  return { m1, m2, insurer, asset, policy };
}

/** Raw query helper — returns snake_case rows directly from SQLite. */
function rawQuery(table: string) {
  return getRawSqlite().prepare(`SELECT * FROM ${table}`).all();
}

// ── Tests ────────────────────────────────────────────────────────────

describe("backup service", () => {
  let db: DbInstance;

  beforeEach(() => {
    db = getTestDb();
  });

  // ── buildBackup ──

  describe("buildBackup", () => {
    test("includes version 1 and valid exportedAt", async () => {
      const backup = await buildBackup(db);
      expect(backup.version).toBe(1);
      expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt);
    });

    test("includes all 9 table keys", async () => {
      const keys = Object.keys((await buildBackup(db)).data);
      for (const key of ALL_TABLE_KEYS) {
        expect(keys).toContain(key);
      }
      expect(keys.length).toBe(ALL_TABLE_KEYS.length);
    });

    test("all tables return arrays", async () => {
      const backup = await buildBackup(db);
      for (const key of ALL_TABLE_KEYS) {
        expect(Array.isArray(backup.data[key])).toBe(true);
      }
    });

    test("empty database returns empty arrays", async () => {
      const backup = await buildBackup(db);
      for (const key of ALL_TABLE_KEYS) {
        expect(backup.data[key]).toEqual([]);
      }
    });

    test("uses snake_case column names (raw SQL format)", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      const member = backup.data.members[0]!;
      // Should have snake_case keys from conversion
      expect(member).toHaveProperty("birth_date");
      expect(member).toHaveProperty("created_at");
      expect(member).not.toHaveProperty("birthDate");
      expect(member).not.toHaveProperty("createdAt");
    });

    test("timestamps are raw integers (not Date objects)", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      const member = backup.data.members[0]!;
      expect(typeof member.created_at).toBe("number");
    });

    test("includes seeded members", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      expect(backup.data.members.length).toBe(2);
      expect(backup.data.members[0]!.name).toBe("张三");
      expect(backup.data.members[1]!.name).toBe("李四");
    });

    test("includes seeded policies", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      expect(backup.data.policies.length).toBe(1);
      expect(backup.data.policies[0]!.policy_number).toBe("POL-001");
    });

    test("includes seeded settings", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      expect(backup.data.settings.length).toBe(2);
    });

    test("includes seeded beneficiaries", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      expect(backup.data.beneficiaries.length).toBe(1);
    });

    test("includes seeded assets", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      expect(backup.data.assets.length).toBe(1);
      expect(backup.data.assets[0]!.name).toBe("沪A12345");
    });

    test("backup is JSON-serializable roundtrip", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
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
    test("restoring into empty db inserts all data", async () => {
      await seedFamily();
      const backup = await buildBackup(db);

      // clear everything
      resetTestDb();
      expect(rawQuery("members")).toEqual([]);

      // restore
      const counts = await restoreBackup(db, backup);

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

    test("restore replaces existing data (full overwrite)", async () => {
      // seed backup source
      await seedFamily();
      const backup = await buildBackup(db);

      // reset and add different data
      resetTestDb();
      await membersRepo.create({ name: "旧数据", relation: "Self" });
      await membersRepo.create({ name: "旧数据2", relation: "Spouse" });
      expect(rawQuery("members").length).toBe(2);

      // restore should replace everything
      await restoreBackup(db, backup);
      const members = rawQuery("members");
      expect(members.length).toBe(2);
      expect((members[0] as { name: string }).name).toBe("张三");
      expect((members[1] as { name: string }).name).toBe("李四");
    });

    test("restore preserves original IDs", async () => {
      await seedFamily();
      const backup = await buildBackup(db);
      const originalIds = backup.data.members.map((m) => m.id);

      resetTestDb();
      await restoreBackup(db, backup);

      const restoredIds = rawQuery("members").map((m: unknown) => (m as { id: number }).id);
      expect(restoredIds).toEqual(originalIds);
    });

    test("restore preserves FK relationships", async () => {
      await seedFamily();
      const backup = await buildBackup(db);

      resetTestDb();
      await restoreBackup(db, backup);

      const policies = rawQuery("policies") as { applicant_id: number }[];
      const members = rawQuery("members") as { id: number }[];
      const memberIds = members.map((m) => m.id);
      // policy's applicant_id should match a member's id
      expect(memberIds).toContain(policies[0]!.applicant_id);
    });

    test("restore with empty data clears everything", async () => {
      await seedFamily();
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
          coverageItems: [],
          settings: [],
        },
      };

      await restoreBackup(db, emptyBackup);
      expect(rawQuery("members")).toEqual([]);
      expect(rawQuery("policies")).toEqual([]);
      expect(rawQuery("settings")).toEqual([]);
    });

    test("restore throws on invalid payload", async () => {
      expect(restoreBackup(db, { version: 99 } as BackupData)).rejects.toThrow(/Invalid backup/);
    });

    test("roundtrip: export → restore → export produces identical data", async () => {
      await seedFamily();
      const backup1 = await buildBackup(db);

      resetTestDb();
      await restoreBackup(db, backup1);
      const backup2 = await buildBackup(db);

      // Compare data (ignore exportedAt timestamp)
      expect(backup2.data.members).toEqual(backup1.data.members);
      expect(backup2.data.insurers).toEqual(backup1.data.insurers);
      expect(backup2.data.assets).toEqual(backup1.data.assets);
      expect(backup2.data.policies).toEqual(backup1.data.policies);
      expect(backup2.data.beneficiaries).toEqual(backup1.data.beneficiaries);
      expect(backup2.data.payments).toEqual(backup1.data.payments);
      expect(backup2.data.cashValues).toEqual(backup1.data.cashValues);
      expect(backup2.data.settings).toEqual(backup1.data.settings);
    });

    test("restore handles payments and cashValues", async () => {
      const m = await membersRepo.create({ name: "Test", relation: "Self" });
      const p = await policiesRepo.create({
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
      await paymentsRepo.create({
        policyId: p.id,
        periodNumber: 1,
        dueDate: "2025-01-01",
        amount: 5000,
        status: "Paid",
      });
      await cashValuesRepo.create({ policyId: p.id, policyYear: 1, value: 3000 });

      const backup = await buildBackup(db);
      expect(backup.data.payments.length).toBe(1);
      expect(backup.data.cashValues.length).toBe(1);

      resetTestDb();
      const counts = await restoreBackup(db, backup);
      expect(counts.payments).toBe(1);
      expect(counts.cashValues).toBe(1);

      expect(rawQuery("payments").length).toBe(1);
      expect(rawQuery("cash_values").length).toBe(1);
    });

    test("restore is atomic: failed insert rolls back all changes", async () => {
      await seedFamily();
      const backup = await buildBackup(db);

      resetTestDb();
      await membersRepo.create({ name: "Should survive", relation: "Self" });

      // Corrupt the backup: duplicate policy_number will violate UNIQUE constraint
      const corruptBackup = JSON.parse(JSON.stringify(backup)) as BackupData;
      if (corruptBackup.data.policies.length > 0) {
        corruptBackup.data.policies.push({ ...corruptBackup.data.policies[0]! });
      }

      await expect(restoreBackup(db, corruptBackup)).rejects.toThrow();

      // After rollback, the original data should still be intact
      const members = rawQuery("members") as { name: string }[];
      expect(members.length).toBe(1);
      expect(members[0]!.name).toBe("Should survive");
    });
  });
});
